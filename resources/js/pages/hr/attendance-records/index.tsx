import { useEffect, useMemo, useRef, useState } from 'react';
import { PageTemplate } from '@/components/page-template';
import { usePage, router } from '@inertiajs/react';
import { Clock, Download, LogIn, LogOut, Pencil, Plus, Trash2, Upload } from 'lucide-react';
import { hasPermission } from '@/utils/authorization';
import { CrudFormModal } from '@/components/CrudFormModal';
import { CrudDeleteModal } from '@/components/CrudDeleteModal';
import { toast } from '@/components/custom-toast';
import { useTranslation } from 'react-i18next';
import { formatEmployeeOptionLabel, getEmployeeSearchText } from '@/utils/helpers';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export default function AttendanceRecords() {
  const { t } = useTranslation();
  const { auth, attendanceDays = [], attendanceAnalytics = {}, employees = [], selectedEmployee, filters: pageFilters = {}, flash = {} } = usePage().props as any;
  const permissions = auth?.permissions || [];
  const sortedEmployees = useMemo(() => {
    const employeeNumber = (employee: any) => {
      const numericId = String(employee?.employee_id ?? '').replace(/\D/g, '');
      return numericId ? Number(numericId) : Number.MAX_SAFE_INTEGER;
    };

    return [...employees].sort((a: any, b: any) => {
      const idDiff = employeeNumber(a) - employeeNumber(b);
      return idDiff !== 0 ? idDiff : String(a?.name ?? '').localeCompare(String(b?.name ?? ''));
    });
  }, [employees]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(pageFilters.employee_id?.toString() || sortedEmployees?.[0]?.id?.toString() || '');
  const selectedEmployeeObject = sortedEmployees.find((employee: any) => employee.id.toString() === selectedEmployeeId);
  const selectedEmployeeDisplay = selectedEmployeeObject
    ? formatEmployeeOptionLabel(selectedEmployeeObject)
    : selectedEmployee?.name
      ? formatEmployeeOptionLabel(selectedEmployee)
      : t('Employee');
  const [employeeSearch, setEmployeeSearch] = useState(selectedEmployeeDisplay === t('Employee') ? '' : selectedEmployeeDisplay);
  const [isEmployeeMenuOpen, setIsEmployeeMenuOpen] = useState(false);
  const currentMonth = () => {
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  };
  const [selectedMonth, setSelectedMonth] = useState(pageFilters.month || currentMonth());
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [currentItem, setCurrentItem] = useState<any>(null);
  const [formMode, setFormMode] = useState<'create' | 'edit' | 'view'>('create');
  const [addingClockInId, setAddingClockInId] = useState<number | null>(null);
  const [attendanceImportMapping, setAttendanceImportMapping] = useState<any>(null);
  const [employeeMappings, setEmployeeMappings] = useState<Record<string, string>>({});
  const [ignoredImportGroups, setIgnoredImportGroups] = useState<Record<string, boolean>>({});
  const [mappingEmployeeSearches, setMappingEmployeeSearches] = useState<Record<string, string>>({});
  const [openMappingEmployeePicker, setOpenMappingEmployeePicker] = useState<string | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const groupedAttendanceImportRows = useMemo(() => {
    const groups = new Map<string, any>();

    (attendanceImportMapping?.rows || []).forEach((row: any) => {
      const key = row.employee_no
        ? `employee:${row.employee_no}`
        : row.sheet_name
          ? `sheet:${row.sheet_name}`
          : `line:${row.line}`;

      if (!groups.has(key)) {
        groups.set(key, {
          ...row,
          key,
          lines: [],
          dates: [],
          first_clock_in: row.clock_in,
          first_clock_out: row.clock_out,
        });
      }

      const group = groups.get(key);
      group.lines.push(row.line);
      if (row.date) group.dates.push(row.date);
      if (!group.suggested_employee_id && row.suggested_employee_id) {
        group.suggested_employee_id = row.suggested_employee_id;
        group.suggested_employee_name = row.suggested_employee_name;
      }
    });

    return Array.from(groups.values());
  }, [attendanceImportMapping]);

  useEffect(() => {
    if (!flash?.attendance_import_mapping) return;

    const mapping = flash.attendance_import_mapping;
    const defaults: Record<string, string> = {};

    (mapping.rows || []).forEach((row: any) => {
      if (row.suggested_employee_id) {
        const key = row.employee_no
          ? `employee:${row.employee_no}`
          : row.sheet_name
            ? `sheet:${row.sheet_name}`
            : `line:${row.line}`;
        defaults[key] = String(row.suggested_employee_id);
      }
    });

    setAttendanceImportMapping(mapping);
    setEmployeeMappings(defaults);
    setIgnoredImportGroups({});
    setMappingEmployeeSearches({});
    setOpenMappingEmployeePicker(null);
  }, [flash?.attendance_import_mapping]);

  const applyFilters = (employeeId = selectedEmployeeId, month = selectedMonth) => {
    router.get(route('hr.attendance-records.index'), {
      employee_id: employeeId || undefined,
      month: month || undefined,
    }, { preserveState: true, preserveScroll: true });
  };

  const moveMonth = (delta: number) => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const date = new Date(year, month - 1 + delta, 1);
    const nextMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    setSelectedMonth(nextMonth);
    applyFilters(selectedEmployeeId, nextMonth);
  };

  const formatTime = (value?: string | null) => {
    if (!value) return '-';
    return window.appSettings?.formatTime?.(value) || value;
  };

  const formatHours = (value: number | string | null | undefined) => `${Number(value || 0).toFixed(2)}h`;

  const formatMinutes = (minutes: number | string | null | undefined) => {
    const total = Number(minutes || 0);
    if (total <= 0) return '0m';
    const hours = Math.floor(total / 60);
    const mins = total % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  const statusBadge = (day: any) => {
    const configs: Record<string, string> = {
      present: 'bg-green-50 text-green-700 ring-green-600/20',
      absent: 'bg-red-50 text-red-700 ring-red-600/20',
      half_day: 'bg-yellow-50 text-yellow-700 ring-yellow-600/20',
      on_leave: 'bg-blue-50 text-blue-700 ring-blue-600/20',
      holiday: 'bg-purple-50 text-purple-700 ring-purple-600/20',
      no_clockout: 'bg-orange-50 text-orange-700 ring-orange-600/20',
      no_record: 'bg-gray-50 text-gray-700 ring-gray-600/20',
    };
    const labels: Record<string, string> = {
      present: t('Present'),
      absent: t('Absent'),
      half_day: t('Half Day'),
      on_leave: day.leave_type ? `${t('On Leave')} (${day.leave_type.name})` : t('On Leave'),
      holiday: day.holiday?.name ? `${t('Holiday')}: ${day.holiday.name}` : t('Holiday'),
      no_clockout: t('No Clockout'),
      no_record: t('No Record'),
    };

    return (
      <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${configs[day.status] || configs.no_record}`}>
        {labels[day.status] || day.status}
      </span>
    );
  };

  const handleAddNew = (day?: any) => {
    setCurrentItem({
      employee_id: selectedEmployeeId,
      date: day?.date || `${selectedMonth}-01`,
      break_hours: 0,
      status: 'present',
    });
    setFormMode('create');
    setIsFormModalOpen(true);
  };

  const handleEdit = (day: any) => {
    setCurrentItem(day);
    setFormMode('edit');
    setIsFormModalOpen(true);
  };

  const handleDelete = (day: any) => {
    setCurrentItem(day);
    setIsDeleteModalOpen(true);
  };

  const handleFormSubmit = (formData: any) => {
    const request = formMode === 'create'
      ? router.post
      : (url: string, data: any, options: any) => router.put(url, data, options);
    const url = formMode === 'create'
      ? route('hr.attendance-records.store')
      : route('hr.attendance-records.update', currentItem.id);

    toast.loading(formMode === 'create' ? t('Creating attendance record...') : t('Updating attendance record...'));
    request(url, formData, {
      onSuccess: (page: any) => {
        setIsFormModalOpen(false);
        toast.dismiss();
        if (page.props.flash?.success) toast.success(t(page.props.flash.success));
        if (page.props.flash?.error) toast.error(t(page.props.flash.error));
      },
      onError: (errors: any) => {
        toast.dismiss();
        toast.error(typeof errors === 'string' ? errors : Object.values(errors).join(', '));
      },
    });
  };

  const handleAddDefaultClockIn = (day: any) => {
    const defaultClockInTime = day.default_clock_in_time || day.on_duty;
    if (!day.id || !defaultClockInTime || addingClockInId === day.id) return;
    const normalizedClockInTime = String(defaultClockInTime).slice(0, 5);

    setAddingClockInId(day.id);
    toast.loading(t('Adding clock in time...'));

    router.put(route('hr.attendance-records.update', day.id), {
      employee_id: day.employee_id,
      date: day.date,
      clock_in: normalizedClockInTime,
      clock_out: day.clock_out,
      break_hours: day.break_hours || 0,
      is_holiday: !!day.is_holiday,
      status: day.status === 'no_record' ? 'present' : day.status,
      notes: day.notes || '',
    }, {
      preserveScroll: true,
      onSuccess: (page: any) => {
        toast.dismiss();
        if (page.props.flash?.attendance_import_mapping) return;
        if (page.props.flash?.success) toast.success(t(page.props.flash.success));
        if (page.props.flash?.error) toast.error(t(page.props.flash.error));
      },
      onError: (errors: any) => {
        toast.dismiss();
        toast.error(typeof errors === 'string' ? errors : Object.values(errors).join(', '));
      },
      onFinish: () => {
        setAddingClockInId(null);
      },
    });
  };

  const handleMappingChange = (mappingKey: number | string, employeeId: string) => {
    const employee = sortedEmployees.find((item: any) => item.id.toString() === employeeId);

    setEmployeeMappings((current) => ({
      ...current,
      [String(mappingKey)]: employeeId,
    }));
    setMappingEmployeeSearches((current) => ({
      ...current,
      [String(mappingKey)]: employee ? formatEmployeeOptionLabel(employee) : '',
    }));
    setOpenMappingEmployeePicker(null);

    if (employeeId) {
      setIgnoredImportGroups((current) => {
        const next = { ...current };
        delete next[String(mappingKey)];
        return next;
      });
    }
  };

  const toggleIgnoredImportGroup = (mappingKey: string) => {
    setIgnoredImportGroups((current) => {
      const next = { ...current };

      if (next[mappingKey]) {
        delete next[mappingKey];
      } else {
        next[mappingKey] = true;
      }

      return next;
    });
  };

  const ignoreAllUnassignedImportGroups = () => {
    setIgnoredImportGroups((current) => {
      const next = { ...current };

      groupedAttendanceImportRows.forEach((group: any) => {
        if (!employeeMappings[group.key]) {
          next[group.key] = true;
        }
      });

      return next;
    });
  };

  const submitMappedAttendanceImport = () => {
    if (!attendanceImportMapping?.token) return;

    const missingGroup = groupedAttendanceImportRows.find((group: any) => !employeeMappings[group.key] && !ignoredImportGroups[group.key]);
    if (missingGroup) {
      toast.error(t('Please select or ignore every attendance employee.'));
      return;
    }

    const lineMappings = groupedAttendanceImportRows.reduce((mappings: Record<string, string>, group: any) => {
      if (ignoredImportGroups[group.key]) return mappings;

      group.lines.forEach((line: number | string) => {
        mappings[String(line)] = employeeMappings[group.key];
      });
      return mappings;
    }, {});
    const ignoredLines = groupedAttendanceImportRows.flatMap((group: any) => (
      ignoredImportGroups[group.key] ? group.lines.map((line: number | string) => String(line)) : []
    ));

    toast.loading(t('Importing attendance sheet...'));
    router.post(route('hr.attendance-records.import-sheet'), {
      import_token: attendanceImportMapping.token,
      employee_mappings: lineMappings,
      ignored_attendance_lines: ignoredLines,
    }, {
      preserveScroll: true,
      onSuccess: (page: any) => {
        setAttendanceImportMapping(null);
        setEmployeeMappings({});
        setIgnoredImportGroups({});
        setMappingEmployeeSearches({});
        setOpenMappingEmployeePicker(null);
        toast.dismiss();
        if (page.props.flash?.success) toast.success(t(page.props.flash.success));
        if (page.props.flash?.error) toast.error(t(page.props.flash.error));
      },
      onError: (errors: any) => {
        toast.dismiss();
        toast.error(typeof errors === 'string' ? errors : Object.values(errors).join(', '));
      },
    });
  };

  const handleDeleteConfirm = () => {
    toast.loading(t('Deleting attendance record...'));
    router.delete(route('hr.attendance-records.destroy', currentItem.id), {
      onSuccess: (page) => {
        setIsDeleteModalOpen(false);
        toast.dismiss();
        if (page.props.flash?.success) toast.success(t(page.props.flash.success));
        if (page.props.flash?.error) toast.error(t(page.props.flash.error));
      },
      onError: (errors) => {
        toast.dismiss();
        toast.error(typeof errors === 'string' ? errors : Object.values(errors).join(', '));
      },
    });
  };

  const handleImportSheet = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);
    toast.loading(t('Importing attendance sheet...'));

    router.post(route('hr.attendance-records.import-sheet'), formData, {
      forceFormData: true,
      preserveScroll: true,
      onSuccess: (page: any) => {
        toast.dismiss();
        if (page.props.flash?.success) toast.success(t(page.props.flash.success));
        if (page.props.flash?.error) toast.error(t(page.props.flash.error));
      },
      onError: (errors: any) => {
        toast.dismiss();
        toast.error(typeof errors === 'string' ? errors : Object.values(errors).join(', '));
      },
      onFinish: () => {
        event.target.value = '';
      },
    });
  };

  const downloadAttendance = () => {
    window.location.href = route('hr.attendance-records.export', {
      employee_id: selectedEmployeeId || undefined,
      month: selectedMonth || undefined,
    });
  };

  const pageActions = [
    ...(hasPermission(permissions, 'manage-attendance-records')
      ? [
          { label: t('Download Attendance'), icon: <Download className="mr-2 h-4 w-4" />, onClick: downloadAttendance },
          { label: t('Import Attendance Sheet'), icon: <Upload className="mr-2 h-4 w-4" />, onClick: () => importInputRef.current?.click() },
        ]
      : []),
    ...(hasPermission(permissions, 'create-attendance-records')
      ? [{ label: t('Add Record'), icon: <Plus className="mr-2 h-4 w-4" />, onClick: () => handleAddNew() }]
      : []),
  ];

  const filteredEmployees = sortedEmployees.filter((employee: any) =>
    getEmployeeSearchText(employee).includes(employeeSearch.toLowerCase().trim())
  );

  // Early departure is display-only and must never contribute to this card.
  const totalLateMinutes = attendanceDays.reduce(
    (total: number, day: any) => total + (day.is_late ? Math.max(0, Number(day.late_minutes) || 0) : 0),
    0,
  );

  const selectEmployee = (employee: any) => {
    const employeeId = employee.id.toString();
    setSelectedEmployeeId(employeeId);
    setEmployeeSearch(formatEmployeeOptionLabel(employee));
    setIsEmployeeMenuOpen(false);
    applyFilters(employeeId, selectedMonth);
  };

  const metricCards = [
    { label: t('Present'), value: attendanceAnalytics.present || 0, tone: 'text-green-700' },
    { label: t('Absent'), value: attendanceAnalytics.absent || 0, tone: 'text-red-700' },
    { label: t('No Clock In'), value: attendanceAnalytics.no_clockin || 0, tone: 'text-orange-700' },
    { label: t('Late Days'), value: attendanceAnalytics.late_days || 0, tone: 'text-amber-700' },
    { label: t('Total Late Time'), value: formatMinutes(totalLateMinutes), tone: 'text-amber-700' },
    { label: t('Total Hours'), value: formatHours(attendanceAnalytics.total_hours), tone: 'text-slate-700' },
    { label: t('Overtime'), value: formatHours(attendanceAnalytics.overtime_hours), tone: 'text-indigo-700' },
  ];

  return (
    <PageTemplate
      title={t('Attendance Records')}
      url="/hr/attendance-records"
      actions={pageActions}
      breadcrumbs={[{ title: t('Dashboard'), href: route('dashboard') }, { title: t('Attendance Records') }]}
      noPadding
    >
      <input
        ref={importInputRef}
        type="file"
        accept=".xls,.xlsx,.xlsm,.xlt,.xltx,.xltm,.csv"
        className="hidden"
        onChange={handleImportSheet}
      />

      <div className="relative z-40 mb-4 rounded-lg bg-white p-4 shadow dark:bg-gray-900">
        <div className="grid gap-3 md:grid-cols-[minmax(220px,1fr)_180px_auto_auto_auto]">
          <div
            className="relative"
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                setIsEmployeeMenuOpen(false);
                setEmployeeSearch(selectedEmployeeDisplay === t('Employee') ? '' : selectedEmployeeDisplay);
              }
            }}
          >
            <Input
              value={employeeSearch}
              placeholder={t('Search Employee')}
              onFocus={(event) => {
                setEmployeeSearch('');
                setIsEmployeeMenuOpen(true);
                event.currentTarget.select();
              }}
              onChange={(event) => {
                setEmployeeSearch(event.target.value);
                setIsEmployeeMenuOpen(true);
              }}
            />
            {isEmployeeMenuOpen && (
              <div className="absolute z-[100] mt-1 max-h-72 w-full overflow-y-auto rounded-md border bg-white p-1 shadow-lg dark:bg-gray-900">
                {filteredEmployees.length > 0 ? (
                  filteredEmployees.map((employee: any) => (
                    <button
                      key={employee.id}
                      type="button"
                      className="flex w-full items-center rounded-sm px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                      onMouseDown={(event) => {
                        event.preventDefault();
                        selectEmployee(employee);
                      }}
                    >
                      {formatEmployeeOptionLabel(employee)}
                    </button>
                  ))
                ) : (
                  <div className="px-3 py-2 text-sm text-muted-foreground">{t('No employees found')}</div>
                )}
              </div>
            )}
          </div>
          <Input
            type="month"
            value={selectedMonth}
            onChange={(event) => {
              setSelectedMonth(event.target.value);
              applyFilters(selectedEmployeeId, event.target.value);
            }}
          />
          <Button type="button" variant="outline" onClick={() => moveMonth(-1)}>{t('Previous')}</Button>
          <Button type="button" variant="outline" onClick={() => moveMonth(1)}>{t('Next')}</Button>
          <Button type="button" onClick={() => applyFilters()}>{t('Apply')}</Button>
        </div>
      </div>

      <div className="relative z-10 mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        {metricCards.map((metric) => (
          <div key={metric.label} className="rounded-lg bg-white p-4 shadow dark:bg-gray-900">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{metric.label}</div>
            <div className={`mt-2 text-2xl font-semibold ${metric.tone}`}>{metric.value}</div>
          </div>
        ))}
      </div>

      <div className="relative z-0 overflow-hidden rounded-lg bg-white shadow dark:bg-gray-900">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div>
            <div className="font-semibold">{selectedEmployeeDisplay}</div>
            <div className="text-sm text-muted-foreground">{selectedMonth}</div>
          </div>
          <div className="text-sm text-muted-foreground">
            {attendanceAnalytics.calendar_days || attendanceDays.length} {t('days')}
          </div>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('Date')}</TableHead>
              <TableHead>{t('Day')}</TableHead>
              <TableHead>{t('Status')}</TableHead>
              <TableHead>{t('Duty')}</TableHead>
              <TableHead>{t('Clock In')}</TableHead>
              <TableHead>{t('Clock Out')}</TableHead>
              <TableHead>{t('Work Time')}</TableHead>
              <TableHead>{t('Late')}</TableHead>
              <TableHead>{t('Early')}</TableHead>
              <TableHead className="text-right">{t('Actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {attendanceDays.map((day: any) => {
              const canAddDefaultClockIn = Boolean(
                day.missing_clock_in
                && day.id
                && (day.default_clock_in_time || day.on_duty)
                && hasPermission(permissions, 'edit-attendance-records')
              );

              return (
              <TableRow key={day.date}>
                <TableCell className="font-medium">{window.appSettings?.formatDateTimeSimple?.(day.date, false) || day.date}</TableCell>
                <TableCell>{day.day_name}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {statusBadge(day)}
                    {day.holiday?.name && day.status !== 'holiday' && (
                      <span className="rounded-md bg-purple-50 px-2 py-1 text-xs text-purple-700 ring-1 ring-purple-600/20">
                        {t('Holiday')}: {day.holiday.name}
                      </span>
                    )}
                    {day.missing_clock_in && (
                      <span className="rounded-md bg-orange-50 px-2 py-1 text-xs text-orange-700 ring-1 ring-orange-600/20">
                        {t('No Clock In')}
                      </span>
                    )}
                    {day.is_weekend && <span className="rounded-md bg-slate-50 px-2 py-1 text-xs text-slate-700 ring-1 ring-slate-600/20">{t('Weekend')}</span>}
                  </div>
                </TableCell>
                <TableCell className="font-mono text-xs">{formatTime(day.on_duty)} - {formatTime(day.off_duty)}</TableCell>
                <TableCell>
                  <span className="inline-flex items-center gap-1 font-mono text-green-700">
                    <LogIn className="h-3 w-3" />
                    {formatTime(day.clock_in)}
                    {canAddDefaultClockIn && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="ml-1 h-7 w-7 text-green-700"
                        title={t('Add default clock in time')}
                        disabled={addingClockInId === day.id}
                        onClick={() => handleAddDefaultClockIn(day)}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    )}
                  </span>
                </TableCell>
                <TableCell><span className="font-mono text-red-700"><LogOut className="mr-1 inline h-3 w-3" />{formatTime(day.clock_out)}</span></TableCell>
                <TableCell><span className="font-mono"><Clock className="mr-1 inline h-3 w-3" />{formatHours(day.total_hours)}</span></TableCell>
                <TableCell className={day.late_minutes > 0 ? 'font-medium text-amber-700' : ''}>{formatMinutes(day.late_minutes)}</TableCell>
                <TableCell className={day.early_leave_minutes > 0 ? 'font-medium text-orange-700' : ''}>{formatMinutes(day.early_leave_minutes)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    {canAddDefaultClockIn && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-green-700"
                        title={t('Add default clock in time')}
                        disabled={addingClockInId === day.id}
                        onClick={() => handleAddDefaultClockIn(day)}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    )}
                    {day.id && hasPermission(permissions, 'edit-attendance-records') && (
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(day)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
                    {day.id && hasPermission(permissions, 'delete-attendance-records') && (
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-red-600" onClick={() => handleDelete(day)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                    {!day.id && hasPermission(permissions, 'create-attendance-records') && (
                      <Button type="button" variant="ghost" size="sm" onClick={() => handleAddNew(day)}>
                        <Plus className="h-4 w-4" />
                        {t('Add')}
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <CrudFormModal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        onSubmit={handleFormSubmit}
        formConfig={{
          fields: [
            {
              name: 'employee_id',
              label: t('Employee'),
              type: 'select',
              required: true,
              searchable: true,
              options: sortedEmployees.map((emp: any) => ({
                value: emp.id.toString(),
                label: formatEmployeeOptionLabel(emp),
    searchText: getEmployeeSearchText(emp),
              })),
            },
            { name: 'date', label: t('Date'), type: 'date', required: true },
            { name: 'clock_in', label: t('Clock In Time'), type: 'time' },
            { name: 'clock_out', label: t('Clock Out Time'), type: 'time' },
            { name: 'break_hours', label: t('Break Hours'), type: 'number', min: 0, step: 0.5, defaultValue: 0 },
            {
              name: 'status',
              label: t('Status'),
              type: 'select',
              required: true,
              options: [
                { value: 'present', label: t('Present') },
                { value: 'absent', label: t('Absent') },
                { value: 'holiday', label: t('Holiday') },
              ],
            },
            { name: 'is_holiday', label: t('Holiday'), type: 'checkbox', defaultValue: false },
            { name: 'notes', label: t('Notes'), type: 'textarea' },
          ],
          modalSize: 'lg',
        }}
        initialData={currentItem}
        title={formMode === 'create' ? t('Add Attendance Record') : t('Edit Attendance Record')}
        mode={formMode}
      />

      <CrudDeleteModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDeleteConfirm}
        itemName={selectedEmployee?.name || ''}
        entityName="attendance record"
      />

      <Dialog open={!!attendanceImportMapping} onOpenChange={(open) => !open && setAttendanceImportMapping(null)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>{t('Confirm Attendance Employees')}</DialogTitle>
          </DialogHeader>

          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <span>{t('Select an employee to import, or ignore entries you do not want to import.')}</span>
            <Button type="button" variant="outline" size="sm" onClick={ignoreAllUnassignedImportGroups}>
              {t('Ignore All Unassigned')}
            </Button>
          </div>

          <div className="space-y-3">
            {groupedAttendanceImportRows.map((group: any) => (
              <div
                key={group.key}
                className={`relative grid overflow-visible gap-3 rounded-lg border p-3 shadow-sm md:grid-cols-[1fr_1.2fr] ${
                  ignoredImportGroups[group.key] ? 'border-slate-200 bg-slate-50 opacity-75' : 'border-slate-200 bg-white'
                } ${openMappingEmployeePicker === group.key ? 'z-50' : 'z-0'}`}
              >
                <div className="min-w-0 space-y-1 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-slate-950">
                      {t('Employee No')} {group.employee_no || group.sheet_name || '-'}
                    </span>
                    {ignoredImportGroups[group.key] && (
                      <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-700">
                        {t('Ignored')}
                      </span>
                    )}
                  </div>
                  <div className="text-slate-600">
                    {t('Rows')}: <span className="font-mono">{group.lines.length}</span>
                  </div>
                  <div className="text-slate-600">
                    {t('Dates')}: <span className="font-mono">{group.dates[0] || '-'}{group.dates.length > 1 ? ` - ${group.dates[group.dates.length - 1]}` : ''}</span>
                  </div>
                  <div className="text-slate-600">
                    {t('Sheet name')}: <span className="font-mono">{group.sheet_name || '-'}</span>
                  </div>
                  <div className="text-slate-600">
                    {t('Sample clock')}: <span className="font-mono">{group.first_clock_in || '-'} - {group.first_clock_out || '-'}</span>
                  </div>
                </div>

                <div className="flex flex-col items-start gap-2 sm:flex-row">
                  <div
                    className="relative w-full min-w-0 sm:flex-1"
                    onBlur={(event) => {
                      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                        setOpenMappingEmployeePicker(null);
                        setMappingEmployeeSearches((current) => {
                          const selectedEmployee = sortedEmployees.find((employee: any) => employee.id.toString() === employeeMappings[group.key]);
                          return {
                            ...current,
                            [group.key]: selectedEmployee ? formatEmployeeOptionLabel(selectedEmployee) : '',
                          };
                        });
                      }
                    }}
                  >
                    <Input
                      value={
                        openMappingEmployeePicker === group.key
                          ? mappingEmployeeSearches[group.key] || ''
                          : sortedEmployees.find((employee: any) => employee.id.toString() === employeeMappings[group.key])
                            ? formatEmployeeOptionLabel(sortedEmployees.find((employee: any) => employee.id.toString() === employeeMappings[group.key]))
                            : ''
                      }
                      disabled={!!ignoredImportGroups[group.key]}
                      placeholder={t('Search Employee')}
                      onFocus={(event) => {
                        setOpenMappingEmployeePicker(group.key);
                        setMappingEmployeeSearches((current) => ({ ...current, [group.key]: '' }));
                        event.currentTarget.select();
                      }}
                      onChange={(event) => {
                        setOpenMappingEmployeePicker(group.key);
                        setMappingEmployeeSearches((current) => ({ ...current, [group.key]: event.target.value }));
                      }}
                      className="h-11 bg-white text-sm disabled:bg-slate-100 disabled:text-slate-500"
                    />

                    {openMappingEmployeePicker === group.key && !ignoredImportGroups[group.key] && (
                      <div className="absolute left-0 right-0 top-full z-[100] mt-2 max-h-80 overflow-y-auto rounded-lg border border-slate-200 bg-white py-2 shadow-xl">
                        {sortedEmployees
                          .filter((employee: any) => getEmployeeSearchText(employee).includes((mappingEmployeeSearches[group.key] || '').toLowerCase().trim()))
                          .map((employee: any) => (
                            <button
                              key={employee.id}
                              type="button"
                              className={`block w-full px-4 py-2.5 text-left text-sm text-slate-950 hover:bg-blue-50 hover:text-blue-700 ${
                                employeeMappings[group.key] === employee.id.toString() ? 'bg-blue-50 text-blue-700' : ''
                              }`}
                              onMouseDown={(event) => event.preventDefault()}
                              onClick={() => handleMappingChange(group.key, employee.id.toString())}
                            >
                              {formatEmployeeOptionLabel(employee)}
                            </button>
                          ))}
                        {sortedEmployees.filter((employee: any) => getEmployeeSearchText(employee).includes((mappingEmployeeSearches[group.key] || '').toLowerCase().trim())).length === 0 && (
                          <div className="px-4 py-3 text-sm text-slate-500">{t('No employees found')}</div>
                        )}
                      </div>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant={ignoredImportGroups[group.key] ? 'outline' : 'ghost'}
                    onClick={() => toggleIgnoredImportGroup(group.key)}
                    className="shrink-0 self-start"
                  >
                    {ignoredImportGroups[group.key] ? t('Undo Ignore') : t('Ignore')}
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAttendanceImportMapping(null)}>
              {t('Cancel')}
            </Button>
            <Button type="button" onClick={submitMappedAttendanceImport}>
              {t('Import Attendance')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageTemplate>
  );
}
