import { PageTemplate } from '@/components/page-template';
import { router, usePage } from '@inertiajs/react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

export default function HrReports() {
  const { t } = useTranslation();
  const { filters, attendance, departments, payroll, bonusTotal, outstandingAdvances } = usePage().props as any;
  const [dateFrom, setDateFrom] = useState(filters.date_from);
  const [dateTo, setDateTo] = useState(filters.date_to);
  const metric = (label: string, value: any) => (
    <div className="rounded-lg bg-white p-4 shadow dark:bg-gray-900">
      <div className="text-sm text-gray-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  );

  return (
    <PageTemplate title={t('HR Reports')} url="/hr/reports" breadcrumbs={[{ title: t('Dashboard'), href: route('dashboard') }, { title: t('HR Reports') }]}>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="text-sm">{t('From')}<input className="mt-1 block rounded-md border px-3 py-2 dark:bg-gray-900" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} /></label>
        <label className="text-sm">{t('To')}<input className="mt-1 block rounded-md border px-3 py-2 dark:bg-gray-900" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} /></label>
        <button className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground" onClick={() => router.get(route('hr.reports.index'), { date_from: dateFrom, date_to: dateTo })}>{t('Apply')}</button>
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        {metric(t('Present'), attendance.present || 0)}
        {metric(t('Absent'), attendance.absent || 0)}
        {metric(t('Late Payroll Penalties'), window.appSettings?.formatCurrency?.(payroll?.late_penalty || 0) || (payroll?.late_penalty || 0))}
        {metric(t('Outstanding Advances'), window.appSettings?.formatCurrency?.(outstandingAdvances || 0) || outstandingAdvances)}
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="rounded-lg bg-white p-4 shadow dark:bg-gray-900">
          <h3 className="mb-3 font-semibold">{t('Payroll Summary')}</h3>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between"><dt>{t('Gross Pay')}</dt><dd>{window.appSettings?.formatCurrency?.(payroll?.gross_pay || 0) || payroll?.gross_pay}</dd></div>
            <div className="flex justify-between"><dt>{t('Deductions')}</dt><dd>{window.appSettings?.formatCurrency?.(payroll?.total_deductions || 0) || payroll?.total_deductions}</dd></div>
            <div className="flex justify-between"><dt>{t('Net Pay')}</dt><dd>{window.appSettings?.formatCurrency?.(payroll?.net_pay || 0) || payroll?.net_pay}</dd></div>
            <div className="flex justify-between"><dt>{t('Bonus')}</dt><dd>{window.appSettings?.formatCurrency?.(bonusTotal || 0) || bonusTotal}</dd></div>
          </dl>
        </div>
        <div className="rounded-lg bg-white p-4 shadow dark:bg-gray-900">
          <h3 className="mb-3 font-semibold">{t('Department Employee Count')}</h3>
          <div className="space-y-2 text-sm">
            {(departments || []).map((department: any) => (
              <div key={department.id} className="flex justify-between border-b pb-2"><span>{department.name}</span><span>{department.employees_count}</span></div>
            ))}
          </div>
        </div>
      </div>
    </PageTemplate>
  );
}
