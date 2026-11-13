import { Link, router } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';
import { CalendarDays, Clock3, LogIn, LogOut } from 'lucide-react';
import { PageTemplate } from '@/components/page-template';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import FieldAttendanceCapture from '@/components/field-attendance-capture';

type RecordDay = { date: string; status: string; clock_in: string | null; clock_out: string | null; total_hours: number | null };
type Shift = { name: string; start_time: string | null; end_time: string | null; is_night_shift: boolean };
export default function FieldEmployeeDashboard({ mode, month, records, todayAttendance, employeeName, shift, serverTime, timezone, workingDays }: { mode: 'today' | 'monthly'; month: string; records: RecordDay[]; todayAttendance: RecordDay | null; employeeName: string; shift: Shift | null; serverTime: string; timezone: string; workingDays: string[] }) {
  const clockBase = useRef({ server: Date.parse(serverTime), monotonic: performance.now() });
  const [currentTime, setCurrentTime] = useState(() => new Date(clockBase.current.server));
  useEffect(() => {
    clockBase.current = { server: Date.parse(serverTime), monotonic: performance.now() };
    const tick = () => setCurrentTime(new Date(clockBase.current.server + performance.now() - clockBase.current.monotonic));
    tick();
    const interval = window.setInterval(tick, 1000);
    return () => window.clearInterval(interval);
  }, [serverTime]);
  const dateLabel = new Intl.DateTimeFormat('en-GB', { timeZone: timezone, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(currentTime);
  const timeLabel = new Intl.DateTimeFormat('en-GB', { timeZone: timezone, hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true }).format(currentTime);
  const formatTime = (value: string | null | undefined) => {
    if (!value) return '—';
    const [hours, minutes] = value.split(':').map(Number);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return value;
    return `${hours % 12 || 12}:${String(minutes).padStart(2, '0')} ${hours < 12 ? 'AM' : 'PM'}`;
  };
  const open = !!todayAttendance?.clock_in && !todayAttendance?.clock_out;
  const completed = !!todayAttendance?.clock_out;
  const [year, monthNumber] = month.split('-').map(Number);
  const totalDays = new Date(year, monthNumber, 0).getDate();
  const days = new Map(records.map(record => [record.date, record]));
  const dayRows = Array.from({ length: totalDays }, (_, i) => {
    const date = `${month}-${String(i + 1).padStart(2, '0')}`;
    return { date, record: days.get(date) };
  });
  return <PageTemplate title={mode === 'today' ? "Today's Attendance" : 'Monthly Attendance Report'} url={mode === 'today' ? '/dashboard' : '/hr/my-attendance'}>
    <nav aria-label="Attendance pages" className="mx-auto flex w-full max-w-4xl gap-2 rounded-xl bg-muted p-1 sm:hidden">
      <Link href={route('dashboard')} aria-current={mode === 'today' ? 'page' : undefined} className={`flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg px-3 text-sm font-semibold ${mode === 'today' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'}`}><Clock3 className="h-4 w-4" />Today</Link>
      <Link href={route('hr.field-attendance.my')} aria-current={mode === 'monthly' ? 'page' : undefined} className={`flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg px-3 text-sm font-semibold ${mode === 'monthly' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'}`}><CalendarDays className="h-4 w-4" />Monthly</Link>
    </nav>
    {mode === 'today' ? <div className="mx-auto w-full max-w-3xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-sm text-muted-foreground">Welcome, {employeeName}</p><h2 className="mt-1 text-xl font-semibold">Your attendance today</h2></div><div className="w-full rounded-lg border bg-card px-4 py-3 sm:w-auto sm:text-right"><p className="text-sm text-muted-foreground">{dateLabel}</p><p className="mt-1 text-lg font-semibold tabular-nums">{timeLabel}</p><p className="text-xs text-muted-foreground">{timezone.replaceAll('_', ' ')}</p></div></div>
      <Card><CardContent className="space-y-5 p-4 sm:space-y-6 sm:p-6"><div className="flex flex-col items-stretch justify-between gap-4 sm:flex-row sm:items-center"><div><p className="text-sm text-muted-foreground">Status</p><p className="mt-1 text-lg font-semibold">{completed ? 'Checked out' : open ? 'Checked in' : 'Not checked in'}</p></div><FieldAttendanceCapture clockedIn={open} completed={completed} /></div>
        <div className="rounded-lg border bg-muted/30 p-4"><div className="flex items-center gap-2"><Clock3 className="h-4 w-4 text-primary" /><h3 className="text-sm font-semibold">Scheduled shift</h3></div>{shift ? <><p className="mt-1 text-sm text-muted-foreground">{shift.name} · {workingDays.join(', ') || 'No working days configured'}</p><div className="mt-3 grid grid-cols-2 gap-3"><div><p className="text-xs text-muted-foreground">Expected check in</p><p className="mt-1 font-semibold">{formatTime(shift.start_time)}</p></div><div><p className="text-xs text-muted-foreground">Expected check out{shift.is_night_shift && shift.start_time && shift.end_time && shift.end_time < shift.start_time ? ' (next day)' : ''}</p><p className="mt-1 font-semibold">{formatTime(shift.end_time)}</p></div></div></> : <p className="mt-2 text-sm text-muted-foreground">No shift assigned. Contact your administrator for your schedule.</p>}</div>
        <div className="grid grid-cols-2 gap-3"><div className="rounded-lg border p-3 sm:p-4"><div className="flex items-center gap-2 text-sm text-muted-foreground"><LogIn className="h-4 w-4" />Your check in</div><p className="mt-2 text-xl font-semibold">{formatTime(todayAttendance?.clock_in)}</p></div><div className="rounded-lg border p-3 sm:p-4"><div className="flex items-center gap-2 text-sm text-muted-foreground"><LogOut className="h-4 w-4" />Your check out</div><p className="mt-2 text-xl font-semibold">{formatTime(todayAttendance?.clock_out)}</p></div></div>
        {open && <p className="text-sm text-muted-foreground">Remember to check out at the end of your work.</p>}
      </CardContent></Card>
    </div> : <div className="mx-auto w-full max-w-4xl space-y-5"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm text-muted-foreground">Your records</p><h2 className="mt-1 text-xl font-semibold">Monthly attendance</h2></div><label className="space-y-1 text-sm"><span>Month</span><Input type="month" value={month} onChange={e => e.target.value && router.get(route('hr.field-attendance.my'), { month: e.target.value }, { preserveState: true })} /></label></div>
      <div className="grid grid-cols-2 gap-3"><Card><CardContent className="flex items-center gap-2 p-3 sm:gap-3 sm:p-4"><CalendarDays className="h-5 w-5 text-primary" /><div><p className="text-sm text-muted-foreground">Days with attendance</p><p className="text-xl font-semibold">{records.filter(r => r.clock_in).length}</p></div></CardContent></Card><Card><CardContent className="flex items-center gap-2 p-3 sm:gap-3 sm:p-4"><Clock3 className="h-5 w-5 text-primary" /><div><p className="text-sm text-muted-foreground">Hours recorded</p><p className="text-xl font-semibold">{records.reduce((sum, r) => sum + Number(r.total_hours || 0), 0).toFixed(1)}</p></div></CardContent></Card></div>
      <div className="space-y-2 sm:hidden">{dayRows.map(({ date, record }) => <article key={date} className="rounded-lg border bg-card p-4"><div className="flex items-center justify-between gap-2"><h3 className="font-semibold">{date}</h3><span className="rounded-full bg-muted px-2 py-1 text-xs capitalize text-muted-foreground">{record?.status?.replaceAll('_', ' ') || 'No record'}</span></div><dl className="mt-3 grid grid-cols-3 gap-2 text-sm"><div><dt className="text-xs text-muted-foreground">Check in</dt><dd className="mt-1 font-medium">{formatTime(record?.clock_in)}</dd></div><div><dt className="text-xs text-muted-foreground">Check out</dt><dd className="mt-1 font-medium">{formatTime(record?.clock_out)}</dd></div><div><dt className="text-xs text-muted-foreground">Hours</dt><dd className="mt-1 font-medium">{record?.total_hours ?? '—'}</dd></div></dl></article>)}</div>
      <div className="hidden overflow-x-auto rounded-lg border bg-card sm:block"><table className="w-full text-left text-sm"><thead className="bg-muted/50"><tr><th className="p-3">Date</th><th className="p-3">Status</th><th className="p-3">Check in</th><th className="p-3">Check out</th><th className="p-3">Hours</th></tr></thead><tbody>{dayRows.map(({ date, record }) => <tr key={date} className="border-t"><td className="p-3">{date}</td><td className="p-3 capitalize">{record?.status?.replaceAll('_', ' ') || 'No record'}</td><td className="p-3">{formatTime(record?.clock_in)}</td><td className="p-3">{formatTime(record?.clock_out)}</td><td className="p-3">{record?.total_hours ?? '—'}</td></tr>)}</tbody></table></div>
    </div>}
  </PageTemplate>;
}
