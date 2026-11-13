import { useEffect, useMemo, useState } from 'react';
import { Clock, LogIn, LogOut, Search, Users, UserRoundCog } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/components/custom-toast';
import { router, usePage } from '@inertiajs/react';
import { PageTemplate } from '@/components/page-template';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export default function FieldAttendance() {
  const { employees = [], attendanceDays = [], attendanceAnalytics = {}, selectedEmployee, month } = usePage().props as any;
  const [selected, setSelected] = useState<any>(null);
  const [selectedMonth, setSelectedMonth] = useState(month);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(String(selectedEmployee || ''));
  useEffect(() => { setSelectedEmployeeId(String(selectedEmployee || '')); }, [selectedEmployee]);
  useEffect(() => { setSelectedMonth(month); }, [month]);
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
  const navigate = (employee: string, date: string) => router.get(route('hr.field-attendance.index'), { employee_id: employee || undefined, month: date }, { preserveState: true, preserveScroll: true });
  const moveMonth = (amount: number) => {
    const [year, monthNumber] = selectedMonth.split('-').map(Number);
    const date = new Date(year, monthNumber - 1 + amount, 1);
    const next = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    setSelectedMonth(next); navigate(selectedEmployeeId, next);
  };
  const formatTime = (value?: string | null) => value ? (window.appSettings?.formatTime?.(value) || value) : '–';
  const formatHours = (value: number | string | null | undefined) => `${Number(value || 0).toFixed(2)}h`;
  const formatMinutes = (value: number | string | null | undefined) => {
    const total = Math.max(0, Number(value) || 0);
    return total >= 60 ? `${Math.floor(total / 60)}h ${total % 60}m` : `${total}m`;
  };
  const currentEmployee = fieldEmployees.find((employee: any) => employee.user_id === Number(selectedEmployee));
  const employeeLabel = currentEmployee ? `${currentEmployee.name} (${currentEmployee.employee_id})${currentEmployee.department ? ` (${currentEmployee.department})` : ''}` : 'Select a field employee';
  const totalLateMinutes = attendanceDays.reduce((total: number, day: any) => total + (day.is_late ? Math.max(0, Number(day.late_minutes) || 0) : 0), 0);
  const metrics = [
    { label: 'Present', value: attendanceAnalytics.present || 0, tone: 'text-green-700' },
    { label: 'Absent', value: attendanceAnalytics.absent || 0, tone: 'text-red-700' },
    { label: 'No Clock In', value: attendanceAnalytics.no_clockin || 0, tone: 'text-orange-700' },
    { label: 'Late Days', value: attendanceAnalytics.late_days || 0, tone: 'text-amber-700' },
    { label: 'Total Late Time', value: formatMinutes(totalLateMinutes), tone: 'text-amber-700' },
    { label: 'Total Hours', value: formatHours(attendanceAnalytics.total_hours), tone: 'text-slate-700' },
    { label: 'Overtime', value: formatHours(attendanceAnalytics.overtime_hours), tone: 'text-indigo-700' },
  ];
  const statusStyle: Record<string, string> = {
    present: 'bg-green-50 text-green-700 ring-green-600/20', absent: 'bg-red-50 text-red-700 ring-red-600/20',
    half_day: 'bg-yellow-50 text-yellow-700 ring-yellow-600/20', on_leave: 'bg-blue-50 text-blue-700 ring-blue-600/20',
    holiday: 'bg-purple-50 text-purple-700 ring-purple-600/20', no_record: 'bg-gray-50 text-gray-700 ring-gray-600/20',
  };
  const statusLabel = (day: any) => day.status === 'holiday' && day.holiday?.name ? `Holiday: ${day.holiday.name}` : day.status === 'on_leave' && day.leave_type?.name ? `On Leave (${day.leave_type.name})` : String(day.status || 'No record').replaceAll('_', ' ').replace(/\b\w/g, char => char.toUpperCase());
  return <PageTemplate title="Field Attendance" url="/hr/field-attendance" actions={[{ label: 'Manage field employees', icon: <Users className="h-4 w-4" />, variant: 'outline', onClick: () => setShowEmployees(true) }]} breadcrumbs={[{ title: 'Dashboard', href: route('dashboard') }, { title: 'Field Attendance' }]} noPadding>
    <div className="space-y-4">
      <div className="rounded-lg bg-white p-4 shadow dark:bg-gray-900"><div className="grid gap-3 md:grid-cols-[minmax(220px,1fr)_180px_auto_auto_auto]">
        <select aria-label="Field employee" className="h-10 min-w-0 rounded-md border bg-background px-3 text-sm" value={selectedEmployeeId} onChange={event => { setSelectedEmployeeId(event.target.value); navigate(event.target.value, selectedMonth); }}>
          {fieldEmployees.length === 0 && <option value="">No field employees enabled</option>}
          {fieldEmployees.map((e: any) => <option key={e.id} value={e.user_id}>{e.name} ({e.employee_id}){e.department ? ` (${e.department})` : ''}</option>)}
        </select>
        <Input aria-label="Attendance month" type="month" value={selectedMonth} onChange={event => { setSelectedMonth(event.target.value); if (event.target.value) navigate(selectedEmployeeId, event.target.value); }} />
        <Button type="button" variant="outline" onClick={() => moveMonth(-1)}>Previous</Button><Button type="button" variant="outline" onClick={() => moveMonth(1)}>Next</Button><Button type="button" onClick={() => navigate(selectedEmployeeId, selectedMonth)}>Apply</Button>
      </div></div>
      {selectedEmployee ? <>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{metrics.map(metric => <div key={metric.label} className="rounded-lg border bg-white p-4 shadow-sm dark:bg-gray-900"><p className="text-xs font-medium uppercase text-muted-foreground">{metric.label}</p><p className={`mt-2 text-2xl font-semibold ${metric.tone}`}>{metric.value}</p></div>)}</div>
        <div className="overflow-hidden rounded-lg border bg-white shadow-sm dark:bg-gray-900"><div className="flex flex-wrap items-center justify-between gap-2 border-b p-4"><div><h2 className="font-semibold">{employeeLabel}</h2><p className="text-sm text-muted-foreground">{month}</p></div><span className="text-sm text-muted-foreground">{attendanceAnalytics.calendar_days || attendanceDays.length} days</span></div>
          <div className="overflow-x-auto"><table className="w-full min-w-[1000px] text-left text-sm"><thead className="bg-muted/50 text-muted-foreground"><tr><th className="p-4 font-medium">Date</th><th className="p-4 font-medium">Day</th><th className="p-4 font-medium">Status</th><th className="p-4 font-medium">Duty</th><th className="p-4 font-medium">Clock In</th><th className="p-4 font-medium">Clock Out</th><th className="p-4 font-medium">Work Time</th><th className="p-4 font-medium">Late</th><th className="p-4 font-medium">Early</th><th className="p-4 text-right font-medium">Details</th></tr></thead><tbody>
            {attendanceDays.map((day: any) => <tr key={day.date} className="border-t"><td className="p-4 font-medium">{day.date}</td><td className="p-4">{day.day_name}</td><td className="p-4"><div className="flex flex-wrap gap-1"><span className={`inline-flex rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${statusStyle[day.status] || statusStyle.no_record}`}>{statusLabel(day)}</span>{day.is_weekend && <span className="rounded-md bg-slate-50 px-2 py-1 text-xs text-slate-700 ring-1 ring-slate-600/20">Weekend</span>}{day.missing_clock_in && <span className="rounded-md bg-orange-50 px-2 py-1 text-xs text-orange-700 ring-1 ring-orange-600/20">No Clock In</span>}</div></td><td className="whitespace-nowrap p-4 font-mono text-xs">{formatTime(day.on_duty || day.shift?.start_time)} – {formatTime(day.off_duty || day.shift?.end_time)}</td><td className="whitespace-nowrap p-4 font-mono text-green-700"><LogIn className="mr-1 inline h-3 w-3" />{formatTime(day.clock_in)}</td><td className="whitespace-nowrap p-4 font-mono text-red-700"><LogOut className="mr-1 inline h-3 w-3" />{formatTime(day.clock_out)}</td><td className="whitespace-nowrap p-4 font-mono"><Clock className="mr-1 inline h-3 w-3" />{formatHours(day.total_hours)}</td><td className="p-4">{formatMinutes(day.late_minutes)}</td><td className="p-4">{formatMinutes(day.early_leave_minutes)}</td><td className="p-4 text-right">{day.captures?.length ? <Button size="sm" variant="outline" onClick={() => setSelected(day)}>View</Button> : '–'}</td></tr>)}
          </tbody></table></div>
        </div>
      </> : <div className="rounded-lg border bg-white p-8 text-center text-sm text-muted-foreground dark:bg-gray-900">Enable field attendance for an employee to view their records.</div>}
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
