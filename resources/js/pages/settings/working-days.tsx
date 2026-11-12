import { useMemo, useState } from 'react';
import { PageTemplate } from '@/components/page-template';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from '@/components/custom-toast';
import { router, usePage } from '@inertiajs/react';
import { CalendarPlus, Save, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { DatePicker } from '@/components/ui/date-picker';

const dayOrder = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

const defaultSchedule = dayOrder.reduce((days: Record<string, any>, day, index) => {
  days[day] = {
    enabled: index < 5,
    open_time: '09:00',
    close_time: '18:00',
  };

  return days;
}, {});

type HolidayExclusion = {
  date: string;
  name: string;
};

const normalizeHoliday = (holiday: string | Partial<HolidayExclusion>): HolidayExclusion | null => {
  if (typeof holiday === 'string') {
    return holiday ? { date: holiday, name: 'Holiday' } : null;
  }

  if (!holiday?.date) return null;

  return {
    date: holiday.date,
    name: holiday.name?.trim() || 'Holiday',
  };
};

export default function WorkingDays() {
  const { t } = useTranslation();
  const { workingSchedule = defaultSchedule, workingHolidays = [] } = usePage().props as any;
  const [schedule, setSchedule] = useState<Record<string, any>>(() => {
    const normalized: Record<string, any> = {};
    dayOrder.forEach((day) => {
      normalized[day] = {
        ...defaultSchedule[day],
        ...(workingSchedule[day] || {}),
      };
    });

    return normalized;
  });
  const [holidays, setHolidays] = useState<HolidayExclusion[]>(() => (workingHolidays || [])
    .map(normalizeHoliday)
    .filter(Boolean)
  );
  const [holidayDate, setHolidayDate] = useState('');
  const [holidayName, setHolidayName] = useState('');

  const formatDay = (day: string) => t(day.charAt(0).toUpperCase() + day.slice(1));

  const updateDay = (day: string, key: string, value: any) => {
    setSchedule((current) => ({
      ...current,
      [day]: {
        ...current[day],
        [key]: value,
      },
    }));
  };

  const dayHours = (day: string) => {
    const { enabled, open_time, close_time } = schedule[day];
    if (!enabled || !open_time || !close_time) return 0;
    const [openHours, openMinutes] = open_time.split(':').map(Number);
    const [closeHours, closeMinutes] = close_time.split(':').map(Number);
    let openTotal = (openHours * 60) + openMinutes;
    let closeTotal = (closeHours * 60) + closeMinutes;
    if (closeTotal <= openTotal) closeTotal += 24 * 60;

    return Number(((closeTotal - openTotal) / 60).toFixed(2));
  };

  const weeklyHours = useMemo(
    () => dayOrder.reduce((total, day) => total + dayHours(day), 0),
    [schedule]
  );

  const addHoliday = () => {
    if (!holidayDate || holidays.some((holiday) => holiday.date === holidayDate)) return;
    setHolidays((current) => [
      ...current,
      { date: holidayDate, name: holidayName.trim() || t('Holiday') },
    ].sort((a, b) => a.date.localeCompare(b.date)));
    setHolidayDate('');
    setHolidayName('');
  };

  const removeHoliday = (date: string) => {
    setHolidays((current) => current.filter((holiday) => holiday.date !== date));
  };

  const handleSubmit = () => {
    toast.loading(t('Saving working schedule...'));
    router.post(route('settings.working-days.update'), { schedule, holidays }, {
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
    });
  };

  return (
    <PageTemplate
      title={t('Working Days & Time')}
      url="/settings/working-days"
      breadcrumbs={[{ title: t('Dashboard'), href: route('dashboard') }, { title: t('Working Days & Time') }]}
      actions={[{ label: t('Save'), icon: <Save className="mr-2 h-4 w-4" />, onClick: handleSubmit }]}
      noPadding
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="rounded-lg bg-white shadow dark:bg-gray-900">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div>
              <div className="font-semibold">{t('Weekly Schedule')}</div>
              <div className="text-sm text-muted-foreground">{t('Total weekly hours')}: {weeklyHours.toFixed(2)}h</div>
            </div>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('Day')}</TableHead>
                <TableHead>{t('Working')}</TableHead>
                <TableHead>{t('Open Time')}</TableHead>
                <TableHead>{t('Close Time')}</TableHead>
                <TableHead>{t('Hours')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dayOrder.map((day) => (
                <TableRow key={day}>
                  <TableCell className="font-medium">{formatDay(day)}</TableCell>
                  <TableCell>
                    <input
                      type="checkbox"
                      checked={!!schedule[day]?.enabled}
                      onChange={(event) => updateDay(day, 'enabled', event.target.checked)}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="time"
                      value={schedule[day]?.open_time || '09:00'}
                      disabled={!schedule[day]?.enabled}
                      onChange={(event) => updateDay(day, 'open_time', event.target.value)}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="time"
                      value={schedule[day]?.close_time || '18:00'}
                      disabled={!schedule[day]?.enabled}
                      onChange={(event) => updateDay(day, 'close_time', event.target.value)}
                    />
                  </TableCell>
                  <TableCell className="font-mono">{dayHours(day).toFixed(2)}h</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="rounded-lg bg-white p-4 shadow dark:bg-gray-900">
          <div className="mb-3">
            <div className="font-semibold">{t('Holiday Exclusions')}</div>
            <div className="text-sm text-muted-foreground">{t('Selected dates will not count as working time in payroll.')}</div>
          </div>
          <div className="mb-4 grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
            <Input
              value={holidayName}
              placeholder={t('Holiday name')}
              onChange={(event) => setHolidayName(event.target.value)}
            />
            <DatePicker
              value={holidayDate}
              onChange={setHolidayDate}
            />
            <Button type="button" onClick={addHoliday} size="icon">
              <CalendarPlus className="h-4 w-4" />
            </Button>
          </div>
          <div className="max-h-[420px] space-y-2 overflow-y-auto">
            {holidays.length > 0 ? holidays.map((holiday) => (
              <div key={holiday.date} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{holiday.name}</div>
                  <div className="font-mono text-xs text-muted-foreground">{window.appSettings?.formatDateTimeSimple?.(holiday.date, false) || holiday.date}</div>
                </div>
                <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-red-600" onClick={() => removeHoliday(holiday.date)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            )) : (
              <div className="rounded-md border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
                {t('No holiday exclusions selected')}
              </div>
            )}
          </div>
        </div>
      </div>
    </PageTemplate>
  );
}
