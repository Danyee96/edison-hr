import { useCallback, useEffect, useRef, useState } from 'react';
import { router } from '@inertiajs/react';
import { AlertCircle, Camera, Check, Clock3, MapPin, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from '@/components/custom-toast';

type Step = 'selfie' | 'area' | 'location';
const steps: { key: Step; label: string; icon: typeof Camera }[] = [
  { key: 'selfie', label: 'Selfie', icon: Camera },
  { key: 'area', label: 'Surroundings', icon: Camera },
  { key: 'location', label: 'Location', icon: MapPin },
];

export default function FieldAttendanceCapture({ clockedIn, completed }: { clockedIn: boolean; completed: boolean }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>('selfie');
  const [selfie, setSelfie] = useState('');
  const [area, setArea] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [starting, setStarting] = useState(false);
  const [expired, setExpired] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(120);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraRetry, setCameraRetry] = useState(0);
  const video = useRef<HTMLVideoElement>(null);
  const deadline = useRef(0);
  const attemptToken = useRef('');
  const attemptId = useRef(0);

  const expire = useCallback(() => {
    attemptId.current += 1;
    deadline.current = 0;
    attemptToken.current = '';
    setSelfie(''); setArea(''); setBusy(false); setCameraReady(false);
    setError(''); setSecondsLeft(0); setExpired(true);
  }, []);

  useEffect(() => {
    if (!open || !deadline.current || expired) return;
    const tick = () => {
      const left = Math.max(0, Math.ceil((deadline.current - performance.now()) / 1000));
      setSecondsLeft(left);
      if (left === 0) expire();
    };
    tick();
    const interval = window.setInterval(tick, 250);
    return () => window.clearInterval(interval);
  }, [open, expired, starting, expire]);

  useEffect(() => {
    if (!open || starting || expired || step === 'location') return;
    let stream: MediaStream | undefined; let cancelled = false;
    setCameraReady(false); setError('');
    if (!navigator.mediaDevices?.getUserMedia) { setError('Camera access requires HTTPS and a supported browser.'); return; }
    navigator.mediaDevices.getUserMedia({ video: { facingMode: { exact: step === 'selfie' ? 'user' : 'environment' } }, audio: false }).then(s => {
      if (cancelled) { s.getTracks().forEach(t => t.stop()); return; }
      stream = s; if (video.current) video.current.srcObject = s;
    }).catch(() => { if (!cancelled) setError(`Unable to open the ${step === 'selfie' ? 'front' : 'back'} camera. Allow camera access and try again.`); });
    return () => { cancelled = true; stream?.getTracks().forEach(t => t.stop()); };
  }, [open, step, expired, starting, cameraRetry]);

  const start = async () => {
    const id = ++attemptId.current;
    const requestStarted = performance.now();
    setOpen(true); setStarting(true); setExpired(false); setBusy(false);
    setStep('selfie'); setSelfie(''); setArea(''); setError(''); setSecondsLeft(120);
    deadline.current = 0; attemptToken.current = '';
    try {
      const response = await fetch(route('hr.field-attendance.start'), {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json', 'X-CSRF-TOKEN': document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content || '' },
        body: JSON.stringify({ type: clockedIn ? 'out' : 'in' }),
      });
      if (!response.ok) throw new Error('Unable to start attendance. Please try again.');
      const result = await response.json();
      if (attemptId.current !== id) return;
      attemptToken.current = result.token;
      // Start counting before the request to avoid overstating the server deadline.
      deadline.current = requestStarted + result.seconds * 1000;
      if (performance.now() >= deadline.current) { expire(); return; }
    } catch (err) {
      if (attemptId.current === id) { setExpired(true); setError(err instanceof Error ? err.message : 'Unable to start attendance.'); }
    } finally { if (attemptId.current === id) setStarting(false); }
  };

  const capture = () => {
    if (!deadline.current || performance.now() >= deadline.current) { expire(); return; }
    const v = video.current; if (!v?.videoWidth) { setError('Camera is not ready yet.'); return; }
    const canvas = document.createElement('canvas'); const scale = Math.min(1, 1280 / v.videoWidth);
    canvas.width = Math.round(v.videoWidth * scale); canvas.height = Math.round(v.videoHeight * scale);
    const context = canvas.getContext('2d');
    if (!context) { setError('Unable to capture the photo. Please try again.'); return; }
    context.drawImage(v, 0, 0, canvas.width, canvas.height);
    const photo = canvas.toDataURL('image/jpeg', 0.8);
    if (step === 'selfie') { setSelfie(photo); setStep('area'); } else { setArea(photo); setStep('location'); }
  };

  const submit = () => {
    if (!navigator.geolocation) { setError('Location is not supported by this browser.'); return; }
    if (!deadline.current || performance.now() >= deadline.current) { expire(); return; }
    const id = attemptId.current;
    setBusy(true); setError('');
    navigator.geolocation.getCurrentPosition(position => {
      if (attemptId.current !== id) return;
      if (performance.now() >= deadline.current) { expire(); return; }
      router.post(route('hr.field-attendance.capture'), {
        attempt_token: attemptToken.current, type: clockedIn ? 'out' : 'in', selfie, area,
        latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: position.coords.accuracy,
      }, {
        onSuccess: page => { if (page.props.flash?.error) { setError(String(page.props.flash.error)); return; } attemptId.current += 1; deadline.current = 0; setOpen(false); toast.success('Attendance recorded.'); },
        onError: errors => { if (errors.attempt) { expire(); setError(String(errors.attempt)); } else setError(Object.values(errors).join(' ')); },
        onFinish: () => setBusy(false),
      });
    }, () => { if (attemptId.current === id) { setBusy(false); setError('Unable to get your current location. Allow location access and try again.'); } }, { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 });
  };

  const close = (value: boolean) => { if (!value) { attemptId.current += 1; deadline.current = 0; attemptToken.current = ''; setSelfie(''); setArea(''); } setOpen(value); };
  const stepIndex = steps.findIndex(item => item.key === step);
  const timer = `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, '0')}`;
  return <><Button className="min-h-12 w-full sm:w-auto" disabled={completed} onClick={start}>{completed ? 'Attendance completed' : clockedIn ? 'Field check out' : 'Field check in'}</Button>
    <Dialog open={open} onOpenChange={close}><DialogContent className="max-h-[calc(100dvh-1rem)] w-[calc(100%-1rem)] overflow-y-auto rounded-xl p-0 sm:max-w-xl">
      <DialogHeader className="border-b px-4 pb-3 pt-4 pr-12 text-left sm:px-6 sm:pb-5 sm:pt-6"><DialogTitle className="text-xl">{clockedIn ? 'Field check out' : 'Field check in'}</DialogTitle><DialogDescription>Complete all three steps within 2 minutes.</DialogDescription></DialogHeader>
      <div className="space-y-4 p-4 sm:space-y-5 sm:p-6">
        <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/40 px-4 py-3"><div className="flex items-center gap-2 text-sm font-medium"><Clock3 className="h-4 w-4" />Time remaining</div><span aria-live="off" className={`font-mono text-lg font-semibold ${secondsLeft <= 30 ? 'text-red-600' : 'text-foreground'}`}>{timer}</span></div>
        <ol className="grid grid-cols-3 gap-2" aria-label="Attendance steps">{steps.map((item, index) => { const done = !expired && index < stepIndex; const active = !expired && index === stepIndex; const Icon = item.icon; return <li key={item.key} aria-current={active ? 'step' : undefined} className={`rounded-lg border px-2 py-3 text-center ${active ? 'border-primary bg-primary/10 text-primary' : done ? 'border-green-200 bg-green-50 text-green-700 dark:bg-green-950/30' : 'text-muted-foreground'}`}><div className="mx-auto mb-1 flex h-7 w-7 items-center justify-center rounded-full border border-current">{done ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}</div><span className="block text-xs font-semibold sm:text-sm">{index + 1}. {item.label}</span></li>; })}</ol>
        {starting ? <p className="py-10 text-center text-sm text-muted-foreground">Starting your attendance session…</p> : expired ? <div className="space-y-4 rounded-lg border border-amber-200 bg-amber-50 p-5 text-center dark:bg-amber-950/20"><AlertCircle className="mx-auto h-8 w-8 text-amber-600" /><div><h3 className="font-semibold">{error ? 'Unable to start' : 'Time expired'}</h3><p className="mt-1 text-sm text-muted-foreground">{error || 'Your photos have been cleared. Please start again and complete all three steps.'}</p></div><Button onClick={start}><RotateCcw className="mr-2 h-4 w-4" />Start again</Button></div> : <>
          {step !== 'location' ? <div className="space-y-4"><div><h3 className="font-semibold">{step === 'selfie' ? 'Take your selfie' : 'Photograph your surroundings'}</h3><p className="mt-1 text-sm text-muted-foreground">{step === 'selfie' ? 'Use your front camera and make sure your face is visible.' : 'Use your back camera to show your current work area.'}</p></div><video ref={video} autoPlay playsInline muted onCanPlay={() => setCameraReady(true)} className="aspect-video max-h-[38dvh] w-full rounded-lg bg-slate-950 object-contain" /><Button className="min-h-12 w-full" onClick={capture} disabled={!cameraReady || busy}><Camera className="mr-2 h-4 w-4" />Capture {step === 'selfie' ? 'selfie' : 'area photo'}</Button>{error && <Button className="w-full" variant="outline" onClick={() => setCameraRetry(value => value + 1)}>Retry camera</Button>}</div> : <div className="space-y-4"><div><h3 className="font-semibold">Share your current location</h3><p className="mt-1 text-sm text-muted-foreground">Your photos are ready. Allow location access to complete your attendance.</p></div><div className="grid grid-cols-2 gap-3"><div><p className="mb-1 text-xs font-medium text-muted-foreground">Selfie</p><img src={selfie} alt="Captured selfie" className="aspect-video w-full rounded-lg object-cover" /></div><div><p className="mb-1 text-xs font-medium text-muted-foreground">Surroundings</p><img src={area} alt="Captured surroundings" className="aspect-video w-full rounded-lg object-cover" /></div></div><div className="flex flex-col-reverse gap-2 sm:flex-row"><Button className="min-h-11" variant="outline" disabled={busy} onClick={() => { setSelfie(''); setArea(''); setStep('selfie'); }}>Retake photos</Button><Button className="min-h-12" disabled={busy} onClick={submit}><MapPin className="mr-2 h-4 w-4" />{busy ? 'Getting location…' : 'Get location and submit'}</Button></div></div>}
          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        </>}
      </div>
    </DialogContent></Dialog></>;
}
