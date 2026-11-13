import { useMemo, useState } from 'react';
import { Search, Users, UserRoundCog } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/components/custom-toast';
import { router, usePage } from '@inertiajs/react';
import { PageTemplate } from '@/components/page-template';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export default function FieldAttendance() {
  const { employees = [], records = [], selectedEmployee, month } = usePage().props as any;
  const [selected, setSelected] = useState<any>(null);
  const [loginEmployee, setLoginEmployee] = useState<any>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [loginErrors, setLoginErrors] = useState<Record<string, string>>({});
  const { auth } = usePage().props as any;
  const [showEmployees, setShowEmployees] = useState(false);
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [updatingEmployee, setUpdatingEmployee] = useState<number | null>(null);
  const sortedEmployees = useMemo(() => [...employees].sort((a: any, b: any) =>
    String(a.employee_id || '').localeCompare(String(b.employee_id || ''), undefined, { numeric: true, sensitivity: 'base' }) ||
    String(a.name || '').localeCompare(String(b.name || ''))
  ), [employees]);
  const fieldEmployees = sortedEmployees.filter((employee: any) => employee.field_attendance);
  const matchingEmployees = sortedEmployees.filter((employee: any) =>
    [employee.name, employee.employee_id, employee.department].some((value: unknown) => String(value || '').toLowerCase().includes(employeeSearch.trim().toLowerCase()))
  );
  const changeEmployee = (employee: number, enabled: boolean) => {
    setUpdatingEmployee(employee);
    router.put(route('hr.field-attendance.employee', employee), { field_attendance: enabled }, {
      preserveScroll: true,
      preserveState: true,
      onSuccess: page => { if (page.props.flash?.error) toast.error(String(page.props.flash.error)); },
      onError: () => toast.error('Unable to update field attendance. Please try again.'),
      onFinish: () => setUpdatingEmployee(null),
    });
  };
  const navigate = (employee: number, date: string) => router.get(route('hr.field-attendance.index'), { employee_id: employee, month: date }, { preserveState: true });
  const byDate = new Map(records.map((record: any) => [record.date, record]));
  const [year, monthNumber] = month.split('-').map(Number);
  const days = new Date(year, monthNumber, 0).getDate();
  return <PageTemplate title="Field Attendance" url="/hr/field-attendance">
    <div className="space-y-5 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3"><p>Choose employees who use field attendance, then select an employee to review their records.</p><Button onClick={() => setShowEmployees(true)}>Manage field employees</Button></div>
      <div className="flex flex-wrap gap-3">
        <select className="rounded-md border bg-background px-3 py-2" value={selectedEmployee || ''} onChange={e => navigate(Number(e.target.value), month)}>
          <option value="">Select field employee</option>{fieldEmployees.map((e: any) => <option key={e.id} value={e.user_id}>{e.employee_id} — {e.name}</option>)}
        </select>
        <Input className="w-44" type="month" value={month} onChange={e => e.target.value && navigate(selectedEmployee || '', e.target.value)} />
      </div>
      {selectedEmployee && <div className="overflow-x-auto rounded-lg border"><table className="w-full text-sm"><thead><tr className="border-b text-left"><th className="p-3">Date</th><th className="p-3">Status</th><th className="p-3">Check in</th><th className="p-3">Check out</th><th className="p-3">Hours</th><th className="p-3">Details</th></tr></thead><tbody>
        {Array.from({ length: days }, (_, i) => { const date = `${month}-${String(i + 1).padStart(2, '0')}`; const record: any = byDate.get(date); return <tr className="border-b" key={date}><td className="p-3">{date}</td><td className="p-3">{record?.status || 'No record'}</td><td className="p-3">{record?.clock_in || '—'}</td><td className="p-3">{record?.clock_out || '—'}</td><td className="p-3">{record?.total_hours ?? '—'}</td><td className="p-3">{record?.captures?.length ? <Button size="sm" variant="outline" onClick={() => setSelected(record)}>View</Button> : '—'}</td></tr>; })}
      </tbody></table></div>}
    </div>
    <Dialog open={showEmployees} onOpenChange={setShowEmployees}>
      <DialogContent className="flex max-h-[min(85vh,760px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="border-b px-6 pb-5 pt-6 pr-12 text-left">
          <DialogTitle className="text-xl font-semibold">Manage field employees</DialogTitle>
          <p className="mt-1 text-sm text-muted-foreground">Choose who can check in and out from the field, and manage their login.</p>
        </DialogHeader>
        <div className="space-y-4 border-b bg-muted/20 px-6 py-4">
          <div className="relative"><Search aria-hidden="true" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input aria-label="Search employees" placeholder="Search by name, ID or department" value={employeeSearch} onChange={event => setEmployeeSearch(event.target.value)} className="bg-background pl-9" /></div>
          <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground"><span className="flex items-center gap-2"><Users aria-hidden="true" className="h-4 w-4" />{fieldEmployees.length} enabled for field attendance</span><span>{matchingEmployees.length} {matchingEmployees.length === 1 ? 'employee' : 'employees'}</span></div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-2 sm:px-6">
          {matchingEmployees.length === 0 ? <p className="py-12 text-center text-sm text-muted-foreground">No employees match your search.</p> : matchingEmployees.map((e: any) => (
            <div key={e.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-b py-4 last:border-0">
              <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="font-semibold text-foreground">{e.name}</span><span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">{e.employee_id}</span></div><p className="mt-1 text-sm text-muted-foreground">{e.department || 'No department'}</p></div>
              <div className="flex items-center gap-4">
                {auth?.permissions?.includes('edit-employees') && <Button size="sm" variant="outline" onClick={() => { setLoginEmployee(e); setEmail(e.email); setPassword(''); setConfirmation(''); setLoginErrors({}); }}><UserRoundCog aria-hidden="true" className="mr-2 h-4 w-4" />Login</Button>}
                <div className="flex min-w-[100px] items-center justify-end gap-2"><span className="text-xs font-medium text-muted-foreground">{e.field_attendance ? 'Enabled' : 'Disabled'}</span><Switch aria-label={`Field attendance for ${e.name}`} checked={Boolean(e.field_attendance)} disabled={updatingEmployee !== null} onCheckedChange={checked => changeEmployee(e.id, checked)} /></div>
              </div>
            </div>
          ))}
        </div>
        <div className="flex justify-end border-t bg-background px-6 py-4"><Button variant="outline" onClick={() => setShowEmployees(false)}>Done</Button></div>
      </DialogContent>
    </Dialog>
    <Dialog open={!!loginEmployee} onOpenChange={open => !open && setLoginEmployee(null)}><DialogContent><DialogHeader><DialogTitle>Employee login — {loginEmployee?.name}</DialogTitle></DialogHeader><form className="space-y-3" onSubmit={event => { event.preventDefault(); router.put(route('hr.field-attendance.login', loginEmployee.id), { email, password, password_confirmation: confirmation }, { onSuccess: () => setLoginEmployee(null), onError: errors => setLoginErrors(errors) }); }}><label className="block">Email<Input type="email" value={email} onChange={e => setEmail(e.target.value)} required /></label>{loginErrors.email && <p className="text-red-600">{loginErrors.email}</p>}<label className="block">New password<Input type="password" value={password} onChange={e => setPassword(e.target.value)} minLength={8} /></label><p className="text-sm text-muted-foreground">Leave blank to keep the existing password.</p><label className="block">Confirm password<Input type="password" value={confirmation} onChange={e => setConfirmation(e.target.value)} /></label>{loginErrors.password && <p className="text-red-600">{loginErrors.password}</p>}<Button type="submit">Save login</Button></form></DialogContent></Dialog>
    <Dialog open={!!selected} onOpenChange={open => !open && setSelected(null)}><DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>Attendance details — {selected?.date}</DialogTitle></DialogHeader>{selected?.captures?.map((capture: any) => <section key={capture.id} className="space-y-3 border-t py-3"><h3 className="font-semibold">{capture.type === 'in' ? 'Check in' : 'Check out'}</h3><a className="text-blue-600 underline" target="_blank" rel="noreferrer" href={`https://www.google.com/maps?q=${capture.latitude},${capture.longitude}`}>Open location on map</a><p className="text-sm">{capture.latitude}, {capture.longitude} (accuracy: {capture.accuracy} m)</p><div className="grid grid-cols-2 gap-3">{['selfie', 'area'].map(kind => <div key={kind}><p className="capitalize">{kind}</p><img className="w-full rounded object-contain" src={route('hr.field-attendance.photo', { capture: capture.id, kind })} alt={`${capture.type} ${kind}`} /></div>)}</div></section>)}</DialogContent></Dialog>
  </PageTemplate>;
}
