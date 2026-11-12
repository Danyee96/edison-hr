import { Fragment, useState } from 'react';
import { PageTemplate } from '@/components/page-template';
import { CrudDeleteModal } from '@/components/CrudDeleteModal';
import { CrudFormModal } from '@/components/CrudFormModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Pagination } from '@/components/ui/pagination';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { router, usePage } from '@inertiajs/react';
import { ChevronDown, ChevronLeft, ChevronRight, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatEmployeeOptionLabel, getEmployeeSearchText } from '@/utils/helpers';

export default function PayrollFines() {
  const { t } = useTranslation();
  const { fineEmployees, employees, filters = {} } = usePage().props as any;
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [mode, setMode] = useState<'create' | 'edit' | 'view'>('create');
  const [current, setCurrent] = useState<any>(null);
  const [expandedRows, setExpandedRows] = useState<Record<number, boolean>>({});
  const [searchTerm, setSearchTerm] = useState(filters.search || '');
  const currentMonth = () => new Date().toISOString().slice(0, 7);
  const [selectedMonth, setSelectedMonth] = useState(filters.month || currentMonth());

  const employeeOptions = (employees || []).map((employee: any) => ({
    value: String(employee.id),
    label: formatEmployeeOptionLabel(employee),
    searchText: getEmployeeSearchText(employee),
  }));

  const formatMoney = (value: number | string | null | undefined) => {
    const amount = Number(value || 0);
    return window.appSettings?.formatCurrency?.(amount) || `PKR ${Math.round(amount).toLocaleString('en-US')}`;
  };

  const formatDate = (value: string | null | undefined) => {
    if (!value) return '-';
    return window.appSettings?.formatDateTimeSimple?.(value, false) || value;
  };

  const openCreateForm = (employee?: any) => {
    const today = new Date().toISOString().split('T')[0];
    const defaultDate = today.startsWith(selectedMonth) ? today : `${selectedMonth}-01`;
    setCurrent(employee ? { employee_id: String(employee.id), fine_date: defaultDate } : { fine_date: defaultDate });
    setMode('create');
    setIsFormOpen(true);
  };

  const applyFilters = (month = selectedMonth, search = searchTerm) => {
    router.get(route('hr.payroll-fines.index'), {
      month,
      search: search || undefined,
    }, {
      preserveState: true,
      preserveScroll: true,
    });
  };

  const handleSearch = (event: React.FormEvent) => {
    event.preventDefault();
    applyFilters();
  };

  const changeMonth = (delta: number) => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const date = new Date(year, month - 1 + delta, 1);
    const nextMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    setSelectedMonth(nextMonth);
    applyFilters(nextMonth);
  };

  const openEditForm = (fine: any) => {
    setCurrent(fine);
    setMode('edit');
    setIsFormOpen(true);
  };

  const openDeleteModal = (fine: any) => {
    setCurrent(fine);
    setIsDeleteOpen(true);
  };

  const submitFine = (formData: any) => {
    if (mode === 'create') {
      router.post(route('hr.payroll-fines.store'), formData, {
        onSuccess: () => setIsFormOpen(false),
      });
      return;
    }

    router.put(route('hr.payroll-fines.update', current.id), formData, {
      onSuccess: () => setIsFormOpen(false),
    });
  };

  return (
    <PageTemplate
      title={t('Fine Management')}
      url="/hr/payroll-fines"
      breadcrumbs={[{ title: t('Dashboard'), href: route('dashboard') }, { title: t('Fine Management') }]}
      actions={[{ label: t('Add New Fine'), icon: <Plus className="mr-2 h-4 w-4" />, onClick: () => openCreateForm() }]}
      noPadding
    >
      <div className="overflow-hidden rounded-lg bg-white shadow dark:bg-gray-900">
        <div className="border-b p-4">
          <form onSubmit={handleSearch} className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder={t('Search employee or ID...')}
                className="pl-9 lg:max-w-xl"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="outline" size="icon" onClick={() => changeMonth(-1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Input
                type="month"
                value={selectedMonth}
                onChange={(event) => {
                  setSelectedMonth(event.target.value);
                  applyFilters(event.target.value);
                }}
                className="w-[170px]"
              />
              <Button type="button" variant="outline" size="icon" onClick={() => changeMonth(1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button type="submit" className="text-white hover:text-white">
                <Search className="h-4 w-4" />
                {t('Search')}
              </Button>
            </div>
          </form>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12" />
              <TableHead>{t('Employee ID')}</TableHead>
              <TableHead>{t('Employee')}</TableHead>
              <TableHead>{t('Actual Salary')}</TableHead>
              <TableHead>{t('Fine Total')}</TableHead>
              <TableHead>{t('Latest Fine Date')}</TableHead>
              <TableHead>{t('Entries')}</TableHead>
              <TableHead className="text-right">{t('Actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(fineEmployees?.data || []).length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                  {t('No fines found')}
                </TableCell>
              </TableRow>
            )}

            {(fineEmployees?.data || []).map((employee: any) => {
              const isExpanded = expandedRows[employee.id] ?? false;
              const entries = employee.fines || [];

              return (
                <Fragment key={employee.id}>
                  <TableRow>
                    <TableCell>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setExpandedRows((rows) => ({ ...rows, [employee.id]: !isExpanded }))}
                      >
                        {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </Button>
                    </TableCell>
                    <TableCell>{employee.employee_code || '-'}</TableCell>
                    <TableCell className="font-medium">{employee.name}</TableCell>
                    <TableCell>{formatMoney(employee.salary)}</TableCell>
                    <TableCell className="font-semibold text-red-600">{formatMoney(employee.fine_total)}</TableCell>
                    <TableCell>{formatDate(employee.latest_fine_date)}</TableCell>
                    <TableCell>{entries.length}</TableCell>
                    <TableCell className="text-right">
                      <Button type="button" size="sm" variant="outline" onClick={() => openCreateForm(employee)}>
                        <Plus className="h-4 w-4" />
                        {t('Add Fine')}
                      </Button>
                    </TableCell>
                  </TableRow>

                  {isExpanded && (
                    <TableRow className="bg-muted/30 hover:bg-muted/30">
                      <TableCell />
                      <TableCell colSpan={7} className="p-0">
                        <div className="px-4 py-3">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>{t('Fine Amount')}</TableHead>
                                <TableHead>{t('Date')}</TableHead>
                                <TableHead>{t('Note')}</TableHead>
                                <TableHead className="text-right">{t('Actions')}</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {entries.map((fine: any) => (
                                <TableRow key={fine.id}>
                                  <TableCell>{formatMoney(fine.amount)}</TableCell>
                                  <TableCell>{formatDate(fine.fine_date)}</TableCell>
                                  <TableCell>{fine.notes || '-'}</TableCell>
                                  <TableCell className="text-right">
                                    <div className="flex justify-end gap-2">
                                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditForm(fine)}>
                                        <Pencil className="h-4 w-4" />
                                      </Button>
                                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-red-600" onClick={() => openDeleteModal({ ...fine, employee_name: employee.name })}>
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              );
            })}
          </TableBody>
        </Table>
        <Pagination
          from={fineEmployees?.from || 0}
          to={fineEmployees?.to || 0}
          total={fineEmployees?.total || 0}
          links={fineEmployees?.links}
          entityName={t('employees with fines')}
          onPageChange={(url) => router.get(url)}
        />
      </div>

      <CrudFormModal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSubmit={submitFine}
        initialData={current}
        mode={mode}
        title={mode === 'create' ? t('Add New Fine') : t('Edit Fine')}
        formConfig={{
          modalSize: 'md',
          fields: [
            { name: 'employee_id', label: t('Employee'), type: 'select', required: true, searchable: true, options: employeeOptions },
            { name: 'amount', label: t('Fine Amount'), type: 'number', required: true },
            { name: 'fine_date', label: t('Fine Date'), type: 'date', required: true },
            { name: 'notes', label: t('Note'), type: 'textarea' },
          ],
        }}
      />

      <CrudDeleteModal
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        itemName={current?.employee_name || ''}
        entityName="fine"
        onConfirm={() => router.delete(route('hr.payroll-fines.destroy', current.id), { onSuccess: () => setIsDeleteOpen(false) })}
      />
    </PageTemplate>
  );
}
