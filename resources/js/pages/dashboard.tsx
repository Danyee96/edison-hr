import React from 'react';
import { PageTemplate } from '@/components/page-template';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useTranslation } from 'react-i18next';
import { router } from '@inertiajs/react';
import {
  Banknote,
  Building2,
  CalendarClock,
  ChevronRight,
  Clock,
  RefreshCw,
  Settings,
  TableProperties,
  Users,
} from 'lucide-react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

interface DashboardData {
  stats: {
    totalEmployees: number;
    totalDepartments: number;
    attendanceRate: number;
    presentToday: number;
    noClockoutToday: number;
    monthPresent: number;
    monthAbsent: number;
    monthNoClockout: number;
    latestPayrollNetPay: number;
    latestPayrollTitle?: string;
    latestPayrollStatus?: string;
    draftPayrollRuns: number;
    workingDaysPerWeek: number;
    weeklyHours: number;
    holidaysThisMonth: number;
  };
  charts: {
    departmentStats: Array<{ name: string; employees: number; color: string }>;
    attendanceSummary: Array<{ name: string; value: number; color: string }>;
  };
  recentActivities: {
    payrollRuns: Array<{
      id: number;
      title: string;
      pay_period_start: string;
      pay_period_end: string;
      employee_count: number;
      total_net_pay: number;
      status: string;
    }>;
  };
}

export default function Dashboard({ dashboardData }: { dashboardData: DashboardData }) {
  const { t } = useTranslation();
  const stats = dashboardData?.stats || {};
  const charts = dashboardData?.charts || { departmentStats: [], attendanceSummary: [] };
  const recent = dashboardData?.recentActivities || { payrollRuns: [] };

  const money = (value: number | string | null | undefined) => {
    const amount = Number(value || 0);
    return window.appSettings?.formatCurrency?.(amount) || `PKR ${Math.round(amount).toLocaleString('en-US')}`;
  };

  const date = (value?: string) => {
    if (!value) return '-';
    return window.appSettings?.formatDateTimeSimple?.(value, false) || new Date(value).toLocaleDateString();
  };

  const MetricCard = ({
    label,
    value,
    note,
    icon,
    tone,
    href,
  }: {
    label: string;
    value: React.ReactNode;
    note?: React.ReactNode;
    icon: React.ReactNode;
    tone: string;
    href?: string;
  }) => (
    <Card className="overflow-hidden">
      <CardContent className="flex min-h-[142px] items-center justify-between gap-4 p-5">
        <div>
          <p className="text-sm font-semibold text-muted-foreground">{label}</p>
          <div className="mt-2 text-3xl font-bold text-[#465d78]">{value}</div>
          {note && <div className="mt-2 text-sm text-muted-foreground">{note}</div>}
        </div>
        <div className={`flex size-14 shrink-0 items-center justify-center rounded-full ${tone}`}>
          {icon}
        </div>
      </CardContent>
      {href && (
        <button
          type="button"
          onClick={() => router.get(href)}
          className="flex w-full items-center justify-between border-t px-5 py-2 text-sm font-medium text-[#5b8ff9] hover:bg-[#f5f8ff]"
        >
          {t('Open')}
          <ChevronRight className="h-4 w-4" />
        </button>
      )}
    </Card>
  );

  const quickLinks = [
    { label: t('Employees'), href: route('hr.employees.index'), icon: <Users className="h-4 w-4" /> },
    { label: t('Departments'), href: route('hr.departments.index'), icon: <Building2 className="h-4 w-4" /> },
    { label: t('Attendance Records'), href: route('hr.attendance-records.index'), icon: <CalendarClock className="h-4 w-4" /> },
    { label: t('Payroll Runs'), href: route('hr.payroll-runs.index'), icon: <Banknote className="h-4 w-4" /> },
    { label: t('Working Days & Time'), href: route('settings.working-days.index'), icon: <Settings className="h-4 w-4" /> },
  ];

  const statusClass = (status?: string) => {
    const classes: Record<string, string> = {
      draft: 'bg-gray-50 text-gray-700 ring-gray-600/20',
      completed: 'bg-green-50 text-green-700 ring-green-600/20',
      processing: 'bg-yellow-50 text-yellow-700 ring-yellow-600/20',
      cancelled: 'bg-red-50 text-red-700 ring-red-600/20',
    };
    return classes[status || ''] || classes.draft;
  };

  return (
    <PageTemplate
      title={t('Dashboard')}
      url="/dashboard"
      actions={[
        {
          label: t('Refresh'),
          icon: <RefreshCw className="h-4 w-4" />,
          variant: 'outline',
          onClick: () => window.location.reload(),
        },
      ]}
    >
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <MetricCard
            label={t('Active Employees')}
            value={stats.totalEmployees || 0}
            note={<>{stats.totalDepartments || 0} {t('departments')}</>}
            icon={<Users className="h-6 w-6" />}
            tone="bg-[#e8f0ff] text-[#5b8ff9]"
            href={route('hr.employees.index')}
          />
          <MetricCard
            label={t('Today Attendance')}
            value={`${stats.attendanceRate || 0}%`}
            note={<>{stats.presentToday || 0} {t('present')} / {stats.noClockoutToday || 0} {t('no clockout')}</>}
            icon={<CalendarClock className="h-6 w-6" />}
            tone="bg-[#ddfbfd] text-[#19c7d0]"
            href={route('hr.attendance-records.index')}
          />
          <MetricCard
            label={t('Latest Payroll')}
            value={money(stats.latestPayrollNetPay || 0)}
            note={stats.latestPayrollTitle || t('No payroll run yet')}
            icon={<Banknote className="h-6 w-6" />}
            tone="bg-[#e2faec] text-[#39d486]"
            href={route('hr.payroll-runs.index')}
          />
        </div>

        <div className="grid gap-6 xl:grid-cols-[1fr_1.35fr]">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <TableProperties className="h-5 w-5" />
                {t('Active Tabs')}
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 sm:grid-cols-2">
              {quickLinks.map((item) => (
                <Button
                  key={item.href}
                  type="button"
                  variant="outline"
                  className="h-12 justify-between"
                  onClick={() => router.get(item.href)}
                >
                  <span className="flex items-center gap-2">
                    {item.icon}
                    {item.label}
                  </span>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Clock className="h-5 w-5" />
                {t('Working Schedule')}
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-lg border p-4">
                <p className="text-sm text-muted-foreground">{t('Working Days')}</p>
                <p className="mt-2 text-2xl font-bold">{stats.workingDaysPerWeek || 0}</p>
                <p className="text-xs text-muted-foreground">{t('per week')}</p>
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-sm text-muted-foreground">{t('Weekly Hours')}</p>
                <p className="mt-2 text-2xl font-bold">{stats.weeklyHours || 0}h</p>
                <p className="text-xs text-muted-foreground">{t('selected schedule')}</p>
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-sm text-muted-foreground">{t('Holidays')}</p>
                <p className="mt-2 text-2xl font-bold">{stats.holidaysThisMonth || 0}</p>
                <p className="text-xs text-muted-foreground">{t('this month')}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t('Department Headcount')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {(charts.departmentStats || []).length > 0 ? (
                charts.departmentStats.map((department) => {
                  const max = Math.max(...charts.departmentStats.map((item) => item.employees), 1);
                  return (
                    <div key={department.name} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{department.name}</span>
                        <span className="font-mono">{department.employees}</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted">
                        <div
                          className="h-2 rounded-full"
                          style={{ width: `${(department.employees / max) * 100}%`, backgroundColor: department.color }}
                        />
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="py-10 text-center text-muted-foreground">{t('No department data available')}</div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t('Attendance This Month')}</CardTitle>
            </CardHeader>
            <CardContent>
              {(charts.attendanceSummary || []).some((item) => item.value > 0) ? (
                <div className="grid gap-4 md:grid-cols-[220px_1fr]">
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={charts.attendanceSummary} dataKey="value" innerRadius={55} outerRadius={86}>
                        {charts.attendanceSummary.map((item) => (
                          <Cell key={item.name} fill={item.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex flex-col justify-center gap-3">
                    {charts.attendanceSummary.map((item) => (
                      <div key={item.name} className="flex items-center justify-between rounded-lg border px-3 py-2">
                        <span className="flex items-center gap-2 text-sm">
                          <span className="size-2 rounded-full" style={{ backgroundColor: item.color }} />
                          {t(item.name)}
                        </span>
                        <span className="font-mono font-semibold">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="py-10 text-center text-muted-foreground">{t('No attendance data for this month')}</div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-lg">
                {t('Payroll Runs')}
                <Button type="button" variant="ghost" size="sm" onClick={() => router.get(route('hr.payroll-runs.index'))}>
                  {t('View All')}
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {recent.payrollRuns.length > 0 ? (
                recent.payrollRuns.map((run) => (
                  <button
                    key={run.id}
                    type="button"
                    onClick={() => router.get(route('hr.payroll-runs.show', run.id))}
                    className="flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left hover:bg-muted/40"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{run.title}</p>
                        <Badge variant="outline" className={`text-xs ring-1 ring-inset ${statusClass(run.status)}`}>
                          {t(run.status)}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {date(run.pay_period_start)} - {date(run.pay_period_end)} / {run.employee_count || 0} {t('employees')}
                      </p>
                    </div>
                    <p className="font-mono font-semibold text-[#39d486]">{money(run.total_net_pay)}</p>
                  </button>
                ))
              ) : (
                <div className="py-10 text-center text-muted-foreground">{t('No payroll runs yet')}</div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </PageTemplate>
  );
}
