// pages/hr/payroll-runs/show.tsx
import { useCallback, useEffect, useRef } from 'react';
import { PageTemplate } from '@/components/page-template';
import { usePage, router } from '@inertiajs/react';
import { ArrowLeft, Download, Printer, Users, DollarSign } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getEmployeeCode } from '@/utils/helpers';

export default function PayrollRunShow() {
  const { t } = useTranslation();
  const { payrollRun, holidayExclusions = [] } = usePage().props as any;
  const printCleanupTimeoutRef = useRef<number | null>(null);

  const formatPayrollAmount = (value: number | string | null | undefined) => {
    return Math.round(Number(value || 0)).toLocaleString('en-US');
  };

  const formatDeductionAmount = (value: number | string | null | undefined) => {
    const amount = Math.round(Number(value || 0));
    return amount > 0 ? `-${amount.toLocaleString('en-US')}` : '0';
  };

  const formatEmployeeNumber = (employee: any) => getEmployeeCode(employee) || '-';

  const formatMinutes = (minutes: number | string | null | undefined) => {
    const total = Number(minutes || 0);
    if (total <= 0) return '0m';
    const hours = Math.floor(total / 60);
    const mins = total % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  const formatDays = (value: number | string | null | undefined) => {
    const total = Number(value || 0);
    return Number.isInteger(total) ? String(total) : total.toFixed(2);
  };

  const getEmployeeName = (row: any) => row.employee?.name || row.employee?.employee?.name || row.employee?.full_name || '-';

  const getEmployeeDepartment = (row: any) => row.employee?.employee?.department?.name || row.employee?.department?.name || '-';

  const getManualFineAmount = (row: any) => {
    return Number(row.deductions_breakdown?.['Manual Fine Amount'] || 0);
  };

  const hasLegacyPartialAttendanceInFine = (row: any) => {
    const partialHours = Number(row.deductions_breakdown?.['Partial Attendance Hours'] || 0);
    const fineAmount = getManualFineAmount(row);

    return partialHours > 0 && Number(row.other_deductions || 0) > fineAmount;
  };

  const getDisplayedLateMinutes = (row: any) => {
    const lateMinutes = Number(row.deductions_breakdown?.['Late Minutes'] || 0);
    const partialHours = Number(row.deductions_breakdown?.['Partial Attendance Hours'] || 0);

    return hasLegacyPartialAttendanceInFine(row) ? lateMinutes + (partialHours * 60) : lateMinutes;
  };

  const getDisplayedLatePenalty = (row: any) => {
    const latePenalty = Number(row.late_penalty || 0);
    const partialPenalty = Number(row.deductions_breakdown?.['Partial Attendance Penalty'] || 0);

    return hasLegacyPartialAttendanceInFine(row) ? latePenalty + partialPenalty : latePenalty;
  };

  const payrollEntries = payrollRun.payroll_entries || [];

  const handleDownload = () => {
    window.open(route('hr.payroll-runs.download-pdf', payrollRun.id), '_blank');
  };

  const handlePrint = useCallback(() => {
    const root = document.documentElement;
    const body = document.body;
    const hadRootDark = root.classList.contains('dark');
    const hadBodyDark = body.classList.contains('dark');

    if (printCleanupTimeoutRef.current) {
      window.clearTimeout(printCleanupTimeoutRef.current);
    }

    const restore = () => {
      root.classList.remove('payroll-printing');
      body.classList.remove('payroll-printing');
      root.style.colorScheme = '';
      body.style.colorScheme = '';

      root.classList.toggle('dark', hadRootDark);
      body.classList.toggle('dark', hadBodyDark);

      window.removeEventListener('afterprint', cleanup);
      window.removeEventListener('focus', cleanup);
      printCleanupTimeoutRef.current = null;
    };

    const cleanup = () => {
      if (printCleanupTimeoutRef.current) {
        window.clearTimeout(printCleanupTimeoutRef.current);
      }
      printCleanupTimeoutRef.current = window.setTimeout(restore, 350);
    };

    root.classList.add('payroll-printing');
    body.classList.add('payroll-printing');
    root.classList.remove('dark');
    body.classList.remove('dark');
    root.style.colorScheme = 'light';
    body.style.colorScheme = 'light';

    window.addEventListener('afterprint', cleanup, { once: true });
    window.addEventListener('focus', cleanup, { once: true });

    window.setTimeout(() => {
      window.print();
    }, 50);
  }, []);

  useEffect(() => {
    return () => {
      if (printCleanupTimeoutRef.current) {
        window.clearTimeout(printCleanupTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('print') === '1') {
      window.setTimeout(handlePrint, 500);
    }
  }, [handlePrint]);

  const breadcrumbs = [
    { title: t('Dashboard'), href: route('dashboard') },
    { title: t('Payroll Management'), href: route('hr.payroll-runs.index') },
    { title: t('Payroll Runs'), href: route('hr.payroll-runs.index') },
    { title: payrollRun.title }
  ];

  const pageActions = [
    {
      label: t('Back to List'),
      icon: <ArrowLeft className="h-4 w-4 mr-2" />,
      variant: 'outline',
      onClick: () => router.get(route('hr.payroll-runs.index'))
    }
  ];

  if (payrollRun.status === 'completed') {
    pageActions.unshift({
      label: t('Print'),
      icon: <Printer className="h-4 w-4 mr-2" />,
      variant: 'default',
      onClick: handlePrint
    });
    pageActions.unshift({
      label: t('Download Payroll'),
      icon: <Download className="h-4 w-4 mr-2" />,
      variant: 'outline',
      onClick: handleDownload
    });
  }

  const getStatusColor = (status: string) => {
    const colors = {
      draft: 'bg-gray-50 text-gray-700 ring-gray-600/20',
      processing: 'bg-yellow-50 text-yellow-700 ring-yellow-600/20',
      completed: 'bg-green-50 text-green-700 ring-green-600/20',
      cancelled: 'bg-red-50 text-red-700 ring-red-600/20'
    };
    return colors[status as keyof typeof colors] || colors.draft;
  };

  return (
    <PageTemplate
      title={payrollRun.title}
      url={`/hr/payroll-runs/${payrollRun.id}`}
      actions={pageActions}
      breadcrumbs={breadcrumbs}
    >
      <style>{`
        html.payroll-printing,
        body.payroll-printing {
          background: #ffffff !important;
          color: #111827 !important;
          color-scheme: light !important;
        }
        html.payroll-printing [data-slot="sidebar-inset"],
        html.payroll-printing main {
          background: #ffffff !important;
          color: #111827 !important;
        }
        .payroll-entries-card,
        .payroll-entries-card [data-slot="card"],
        .payroll-entries-card [data-slot="card-content"],
        .payroll-entries-card > div,
        .payroll-entries-card table,
        .payroll-entries-card thead,
        .payroll-entries-card tbody,
        .payroll-entries-card tr,
        .payroll-entries-card th,
        .payroll-entries-card td,
        html.payroll-printing .payroll-entries-card,
        html.payroll-printing .payroll-entries-card [data-slot="card"],
        html.payroll-printing .payroll-entries-card [data-slot="card-content"],
        html.payroll-printing .payroll-entries-card > div,
        html.payroll-printing .payroll-entries-card table,
        html.payroll-printing .payroll-entries-card thead,
        html.payroll-printing .payroll-entries-card tbody,
        html.payroll-printing .payroll-entries-card tr,
        html.payroll-printing .payroll-entries-card th,
        html.payroll-printing .payroll-entries-card td {
          background-color: #ffffff !important;
          color-scheme: light !important;
        }
        .payroll-entries-card thead tr,
        html.payroll-printing .payroll-entries-card thead tr {
          background-color: #f8fafc !important;
        }
        .payroll-slip-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 16px;
        }
        @media (min-width: 1024px) {
          .payroll-slip-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
        .payroll-slip {
          break-inside: avoid;
          page-break-inside: avoid;
          overflow: hidden;
          border: 1px dashed #94a3b8;
          border-radius: 8px;
          background: #ffffff;
          padding: 10px;
        }
        .payroll-slip-table {
          width: 100%;
          table-layout: fixed;
          border-collapse: collapse;
          overflow: hidden;
          border: 2px solid #111827;
          font-size: 15px;
          color: #111827;
        }
        .payroll-slip-table th,
        .payroll-slip-table td {
          border: 1px solid #111827;
          padding: 8px 10px;
          vertical-align: middle;
        }
        .payroll-slip-table th {
          background: #ffffff;
          color: #111827;
          text-align: center;
          font-weight: 800;
        }
        .payroll-slip-table .payroll-slip-employee {
          background: #ffffff;
          color: #050505;
          text-transform: uppercase;
          letter-spacing: 0;
          font-size: 24px;
          line-height: 1.15;
          padding: 18px 10px;
        }
        .payroll-slip-table .payroll-slip-total-head {
          background: #ffffff;
          color: #050505;
          font-size: 18px;
          line-height: 1.2;
        }
        .payroll-slip-table .payroll-slip-total-head span {
          display: block;
          color: #22c55e;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
          font-size: 16px;
          font-weight: 900;
        }
        .payroll-slip-table .payroll-slip-meta td {
          background: #f8fafc;
          color: #475569;
          font-size: 13px;
          font-weight: 700;
          text-align: center;
        }
        .payroll-slip-table td:first-child {
          width: 34%;
          font-weight: 800;
          text-align: center;
        }
        .payroll-slip-table td:nth-child(2) {
          width: 36%;
          text-align: center;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
          color: #374151;
          font-size: 15px;
        }
        .payroll-slip-table .amount {
          width: 30%;
          text-align: center;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
          font-weight: 800;
          font-size: 15px;
          color: #111827;
        }
        .payroll-slip-table .danger {
          color: #dc2626;
        }
        .payroll-slip-table .success {
          color: #16a34a;
        }
        .payroll-slip-total td {
          background: #050505;
          color: #ffffff !important;
          font-size: 17px;
          font-weight: 900;
          text-align: center;
        }
        .payroll-slip-total td:last-child {
          background: #12b85f;
          color: #ffffff !important;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
        }
        @media print {
          html, body, #app, main, [data-slot="sidebar-inset"] {
            background: #fff !important;
            color: #111827 !important;
            color-scheme: light !important;
          }
          @page {
            size: A4 portrait;
            margin: 8mm;
          }
          aside, nav, header, [data-sidebar], .no-print {
            display: none !important;
          }
          main, body {
            background: #fff !important;
          }
          .print\\:shadow-none {
            box-shadow: none !important;
          }
          .payroll-entries-card {
            border: 0 !important;
            box-shadow: none !important;
          }
          .payroll-entries-card [data-slot="card-header"] {
            padding: 0 0 5mm 0 !important;
          }
          .payroll-entries-card [data-slot="card-content"] {
            padding: 0 !important;
          }
          .payroll-slip-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 6mm;
          }
          .payroll-slip {
            border: 1px dashed #64748b;
            border-radius: 0;
            padding: 2mm;
          }
          .payroll-slip-table {
            font-size: 10.5px;
          }
          .payroll-slip-table th,
          .payroll-slip-table td {
            padding: 3.5px 5px;
          }
          .payroll-slip-table .payroll-slip-employee {
            font-size: 17px;
            padding: 8px 5px;
          }
          .payroll-slip-table .payroll-slip-total-head {
            font-size: 13px;
          }
          .payroll-slip-table .payroll-slip-total-head span,
          .payroll-slip-table .amount,
          .payroll-slip-table td:nth-child(2) {
            font-size: 11px;
          }
          .payroll-slip-total td {
            font-size: 12px;
          }
        }
      `}</style>
      {/* Payroll Run Summary */}
      <div className="no-print grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('Total Employees')}</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{payrollRun.employee_count}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('Gross Pay')}</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{window.appSettings?.formatCurrency(payrollRun.total_gross_pay)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('Total Deductions')}</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{window.appSettings?.formatCurrency(payrollRun.total_deductions)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('Net Pay')}</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{window.appSettings?.formatCurrency(payrollRun.total_net_pay)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Payroll Run Details */}
      <Card className="no-print mb-6">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>{t('Payroll Run Details')}</CardTitle>
          {payrollRun.status === 'completed' && (
            <Button type="button" variant="outline" size="sm" onClick={handleDownload}>
              <Download className="mr-2 h-4 w-4" />
              {t('Download Payroll')}
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-500">{t('Pay Period')}</label>
              <p className="text-sm">
                {window.appSettings?.formatDateTimeSimple(payrollRun.pay_period_start, false) || new Date(payrollRun.pay_period_start).toLocaleDateString()} - {window.appSettings?.formatDateTimeSimple(payrollRun.pay_period_end, false) || new Date(payrollRun.pay_period_end).toLocaleDateString()}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">{t('Pay Date')}</label>
              <p className="text-sm">{ window.appSettings?.formatDateTimeSimple(payrollRun.pay_date, false) || new Date(payrollRun.pay_date).toLocaleDateString()}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">{t('Payroll Frequency')}</label>
              <p className="text-sm">
                <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10">
                  {payrollRun.payroll_frequency === 'weekly' ? t('Weekly') : payrollRun.payroll_frequency === 'biweekly' ? t('Bi-Weekly') : t('Monthly')}
                </span>
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">{t('Status')}</label>
              <p>
                <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${getStatusColor(payrollRun.status)}`}>
                  {t(payrollRun.status)}
                </span>
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">{t('Created At')}</label>
              <p className="text-sm">{window.appSettings?.formatDateTimeSimple(payrollRun.created_at, false) || new Date(payrollRun.created_at).toLocaleDateString()}</p>
            </div>
          </div>
          {payrollRun.notes && (
            <div className="mt-4">
              <label className="text-sm font-medium text-gray-500">{t('Notes')}</label>
              <p className="text-sm mt-1">{payrollRun.notes}</p>
            </div>
          )}
          {holidayExclusions.length > 0 && (
            <div className="mt-4">
              <label className="text-sm font-medium text-gray-500">{t('Holiday Exclusions')}</label>
              <div className="mt-2 flex flex-wrap gap-2">
                {holidayExclusions.map((holiday: any) => (
                  <span
                    key={holiday.date}
                    className="inline-flex items-center rounded-md bg-purple-50 px-2 py-1 text-xs font-medium text-purple-700 ring-1 ring-inset ring-purple-600/20"
                  >
                    {holiday.name || t('Holiday')} · {window.appSettings?.formatDateTimeSimple?.(holiday.date, false) || holiday.date}
                  </span>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Employee Payroll Entries */}
      <Card className="payroll-entries-card print:shadow-none">
        <CardHeader>
          <CardTitle>{t('Employee Payroll Entries')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="payroll-slip-grid">
            {payrollEntries.map((entry: any, index: number) => {
              const employeeNumber = formatEmployeeNumber(entry.employee);
              const lateMinutes = getDisplayedLateMinutes(entry);
              const latePenalty = getDisplayedLatePenalty(entry);
              const absentDays = entry.unpaid_leave_days || entry.absent_days || 0;
              const fineAmount = getManualFineAmount(entry);
              const hasBonus = Number(entry.profile_bonus_amount || 0) > 0;

              return (
                <div key={entry.id || `${entry.employee_id}-${index}`} className="payroll-slip">
                  <table className="payroll-slip-table">
                    <tbody>
                      <tr className="payroll-slip-head">
                        <th className="payroll-slip-employee" colSpan={2}>{getEmployeeName(entry)}</th>
                        <th className="payroll-slip-total-head">
                          {t('TOTAL')}
                          <span>{formatPayrollAmount(entry.net_pay)}</span>
                        </th>
                      </tr>
                      <tr className="payroll-slip-meta">
                        <td>{t('Employee ID')}</td>
                        <td>{employeeNumber}</td>
                        <td>{getEmployeeDepartment(entry)}</td>
                      </tr>
                      <tr>
                        <td>{t('LATE')}</td>
                        <td>{formatMinutes(lateMinutes)}</td>
                        <td className="amount danger">{formatDeductionAmount(latePenalty)}</td>
                      </tr>
                      <tr>
                        <td>{t('ABSENT')}</td>
                        <td>{formatDays(absentDays)} {t('days')}</td>
                        <td className="amount danger">{formatDeductionAmount(entry.absence_deduction)}</td>
                      </tr>
                      <tr>
                        <td>{t('FINE')}</td>
                        <td>{formatPayrollAmount(fineAmount)}</td>
                        <td className="amount danger">{formatDeductionAmount(fineAmount)}</td>
                      </tr>
                      {hasBonus && (
                        <tr>
                          <td>{t('BONUS')}</td>
                          <td>{formatPayrollAmount(entry.bonus_amount)}</td>
                          <td className="amount success">{formatPayrollAmount(entry.bonus_amount)}</td>
                        </tr>
                      )}
                      <tr>
                        <td>{t('Salary')}</td>
                        <td>{formatPayrollAmount(entry.basic_salary)}</td>
                        <td className="amount">{formatPayrollAmount(entry.basic_salary)}</td>
                      </tr>
                      <tr>
                        <td>{t('Advance')}</td>
                        <td>{formatPayrollAmount(entry.advance_deduction)}</td>
                        <td className="amount danger">{formatDeductionAmount(entry.advance_deduction)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </PageTemplate>
  );
}
