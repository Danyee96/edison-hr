// pages/hr/payroll-runs/index.tsx
import { useState } from 'react';
import { PageTemplate } from '@/components/page-template';
import { usePage, router } from '@inertiajs/react';
import { Plus } from 'lucide-react';
import { hasPermission } from '@/utils/authorization';
import { CrudTable } from '@/components/CrudTable';
import { CrudFormModal } from '@/components/CrudFormModal';
import { CrudDeleteModal } from '@/components/CrudDeleteModal';
import { toast } from '@/components/custom-toast';
import { useTranslation } from 'react-i18next';
import { formatEmployeeOptionLabel, getEmployeeSearchText } from '@/utils/helpers';
import { Pagination } from '@/components/ui/pagination';
import { SearchAndFilterBar } from '@/components/ui/search-and-filter-bar';
import { InlineDateRangeCalendar, InlineMonthCalendar } from '@/components/ui/date-picker';

export default function PayrollRuns() {
  const { t } = useTranslation();
  const { auth, payrollRuns, employees = [], filters: pageFilters = {} } = usePage().props as any;
  const permissions = auth?.permissions || [];

  // State
  const [searchTerm, setSearchTerm] = useState(pageFilters.search || '');
  const [selectedStatus, setSelectedStatus] = useState(pageFilters.status || 'all');
  const [dateFrom, setDateFrom] = useState(pageFilters.date_from || '');
  const [dateTo, setDateTo] = useState(pageFilters.date_to || '');
  const [showFilters, setShowFilters] = useState(false);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isProcessModalOpen, setIsProcessModalOpen] = useState(false);
  const [isProcessingPayroll, setIsProcessingPayroll] = useState(false);
  const [currentItem, setCurrentItem] = useState<any>(null);
  const [formMode, setFormMode] = useState<'create' | 'edit' | 'view'>('create');

  // Check if any filters are active
  const hasActiveFilters = () => {
    return searchTerm !== '' || selectedStatus !== 'all' || dateFrom !== '' || dateTo !== '';
  };

  // Count active filters
  const activeFilterCount = () => {
    return (searchTerm ? 1 : 0) + (selectedStatus !== 'all' ? 1 : 0) + (dateFrom ? 1 : 0) + (dateTo ? 1 : 0);
  };

  const toDateInputValue = (value?: string) => {
    return value ? String(value).slice(0, 10) : '';
  };

  const monthValueFromDate = (value?: string) => {
    return value ? String(value).slice(0, 7) : '';
  };

  const endOfMonthValue = (month: string) => {
    const [year, monthNumber] = month.split('-').map(Number);
    const lastDay = new Date(year, monthNumber, 0).getDate();
    return `${month}-${String(lastDay).padStart(2, '0')}`;
  };

  const renderPayPeriodRange = (_field: any, formData: any, onChange: (name: string, value: any) => void) => {
    const startValue = toDateInputValue(formData.pay_period_start);
    const endValue = toDateInputValue(formData.pay_period_end);
    const periodMode = formData.pay_period_mode || 'range';
    const disabled = formMode === 'view';

    const switchMode = (mode: 'range' | 'month') => {
      onChange('pay_period_mode', mode);
      onChange('pay_period_start', '');
      onChange('pay_period_end', '');
    };

    const handleMonthChange = (month: string) => {
      if (!month) return;

      onChange('pay_period_start', `${month}-01`);
      onChange('pay_period_end', endOfMonthValue(month));
    };

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2 rounded-lg bg-slate-100 p-1">
          <button
            type="button"
            disabled={disabled}
            onClick={() => switchMode('range')}
            className={`h-9 rounded-md text-sm font-semibold transition ${periodMode === 'range' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-950'}`}
          >
            {t('Pay Period')}
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => switchMode('month')}
            className={`h-9 rounded-md text-sm font-semibold transition ${periodMode === 'month' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-950'}`}
          >
            {t('Month')}
          </button>
        </div>

        {periodMode === 'range' ? (
          <InlineDateRangeCalendar
            startValue={startValue}
            endValue={endValue}
            onStartChange={(value) => onChange('pay_period_start', value)}
            onEndChange={(value) => onChange('pay_period_end', value)}
            disabled={disabled}
          />
        ) : (
          <InlineMonthCalendar
            value={monthValueFromDate(startValue)}
            onChange={handleMonthChange}
            disabled={disabled}
          />
        )}
      </div>
    );
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    applyFilters();
  };

  const applyFilters = () => {
    router.get(route('hr.payroll-runs.index'), {
      page: 1,
      search: searchTerm || undefined,
      status: selectedStatus !== 'all' ? selectedStatus : undefined,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
      per_page: pageFilters.per_page
    }, { preserveState: true, preserveScroll: true });
  };

  const handleSort = (field: string) => {
    const direction = pageFilters.sort_field === field && pageFilters.sort_direction === 'asc' ? 'desc' : 'asc';

    router.get(route('hr.payroll-runs.index'), {
      sort_field: field,
      sort_direction: direction,
      page: 1,
      search: searchTerm || undefined,
      status: selectedStatus !== 'all' ? selectedStatus : undefined,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
      per_page: pageFilters.per_page
    }, { preserveState: true, preserveScroll: true });
  };

  const handleAction = (action: string, item: any) => {
    setCurrentItem(item);

    switch (action) {
      case 'view':
        router.get(route('hr.payroll-runs.show', item.id));
        break;
      case 'edit':
        setFormMode('edit');
        setIsFormModalOpen(true);
        break;
      case 'delete':
        setIsDeleteModalOpen(true);
        break;
      case 'process':
        if (isProcessingPayroll) return;
        setIsProcessModalOpen(true);
        break;
      case 'print':
        window.open(`${route('hr.payroll-runs.show', item.id)}?print=1`, '_blank');
        break;
      case 'download':
        window.open(route('hr.payroll-runs.download-pdf', item.id), '_blank');
        break;
    }
  };

  const handleAddNew = () => {
    setCurrentItem(null);
    setFormMode('create');
    setIsFormModalOpen(true);
  };

  const handleFormSubmit = (formData: any) => {
    if (!formData.pay_period_start || !formData.pay_period_end) {
      toast.error(t('Please select a complete pay period range.'));
      return;
    }

    if (formMode === 'create') {
      toast.loading(t('Creating payroll run...'));

      router.post(route('hr.payroll-runs.store'), formData, {
        onSuccess: (page) => {
          setIsFormModalOpen(false);
          toast.dismiss();
          if (page.props.flash.success) {
            toast.success(t(page.props.flash.success));
          } else if (page.props.flash.error) {
            toast.error(t(page.props.flash.error));
          }
        },
        onError: (errors) => {
          toast.dismiss();
          if (typeof errors === 'string') {
            toast.error(errors);
          } else {
            toast.error(`Failed to create payroll run: ${Object.values(errors).join(', ')}`);
          }
        }
      });
    } else if (formMode === 'edit') {
      toast.loading(t('Updating payroll run...'));

      router.put(route('hr.payroll-runs.update', currentItem.id), formData, {
        onSuccess: (page) => {
          setIsFormModalOpen(false);
          toast.dismiss();
          if (page.props.flash.success) {
            toast.success(t(page.props.flash.success));
          } else if (page.props.flash.error) {
            toast.error(t(page.props.flash.error));
          }
        },
        onError: (errors) => {
          toast.dismiss();
          if (typeof errors === 'string') {
            toast.error(errors);
          } else {
            toast.error(`Failed to update payroll run: ${Object.values(errors).join(', ')}`);
          }
        }
      });
    }
  };

  const handleDeleteConfirm = () => {
    toast.loading(t('Deleting payroll run...'));

    router.delete(route('hr.payroll-runs.destroy', currentItem.id), {
      onSuccess: (page) => {
        setIsDeleteModalOpen(false);
        toast.dismiss();
        if (page.props.flash.success) {
          toast.success(t(page.props.flash.success));
        } else if (page.props.flash.error) {
          toast.error(t(page.props.flash.error));
        }
      },
      onError: (errors) => {
        toast.dismiss();
        if (typeof errors === 'string') {
          toast.error(errors);
        } else {
          toast.error(`Failed to delete payroll run: ${Object.values(errors).join(', ')}`);
        }
      }
    });
  };

  const handleProcessPayroll = (formData: any) => {
    if (isProcessingPayroll || !currentItem?.id) return;

    const payrollRunId = currentItem.id;
    toast.loading(t('Processing payroll...'));

    router.put(route('hr.payroll-runs.process', payrollRunId), {
      select_all: !!formData.select_all,
      employee_ids: formData.select_all ? [] : (formData.employee_ids || []),
    }, {
      preserveState: false,
      preserveScroll: true,
      onStart: () => {
        setIsProcessingPayroll(true);
        setIsProcessModalOpen(false);
        setCurrentItem(null);
      },
      onSuccess: (page) => {
        toast.dismiss();
        if (page.props.flash?.success) {
          toast.success(t(page.props.flash.success));
        } else if (page.props.flash?.error) {
          toast.error(t(page.props.flash.error));
        }
      },
      onError: (errors) => {
        toast.dismiss();
        if (typeof errors === 'string') {
          toast.error(errors);
        } else {
          toast.error(`Failed to process payroll: ${Object.values(errors).join(', ')}`);
        }
      },
      onFinish: () => {
        setIsProcessingPayroll(false);
      }
    });
  };

  const handleResetFilters = () => {
    setSearchTerm('');
    setSelectedStatus('all');
    setDateFrom('');
    setDateTo('');
    setShowFilters(false);

    router.get(route('hr.payroll-runs.index'), {
      page: 1,
      per_page: pageFilters.per_page
    }, { preserveState: true, preserveScroll: true });
  };

  // Define page actions
  const pageActions = [];

  // Add the "Add New Payroll Run" button if user has permission
  if (hasPermission(permissions, 'create-payroll-runs')) {
    pageActions.push({
      label: t('Add Payroll Run'),
      icon: <Plus className="h-4 w-4 mr-2" />,
      variant: 'default',
      onClick: () => handleAddNew()
    });
  }

  const breadcrumbs = [
    { title: t('Dashboard'), href: route('dashboard') },
    { title: t('Payroll Management'), href: route('hr.payroll-runs.index') },
    { title: t('Payroll Runs') }
  ];

  // Define table columns
  const columns = [
    {
      key: 'title',
      label: t('Title'),
      sortable: true
    },
    {
      key: 'payroll_frequency',
      label: t('Frequency'),
      render: (value: string) => (
        <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10">
          {value === 'weekly' ? t('Weekly') : value === 'biweekly' ? t('Bi-Weekly') : t('Monthly')}
        </span>
      )
    },
    {
      key: 'pay_period',
      label: t('Pay Period'),
      render: (value: any, row: any) => (
        <div className="text-sm">
          <div>{window.appSettings?.formatDateTimeSimple(row.pay_period_start, false) || new Date(row.pay_period_start).toLocaleDateString()}</div>
          <div className="text-gray-500">to {window.appSettings?.formatDateTimeSimple(row.pay_period_end, false) || new Date(row.pay_period_end).toLocaleDateString()}</div>
        </div>
      )
    },
    {
      key: 'pay_date',
      label: t('Pay Date'),
      sortable: true,
      render: (value: string) => window.appSettings?.formatDateTimeSimple(value, false) || new Date(value).toLocaleDateString()
    },
    {
      key: 'employee_count',
      label: t('Employees'),
      render: (value: number) => (
        <span className="font-mono">{value}</span>
      )
    },
    {
      key: 'total_gross_pay',
      label: t('Gross Pay'),
      render: (value: number) => (
        <span className="font-mono text-green-600">{window.appSettings?.formatCurrency(value)}</span>
      )
    },
    {
      key: 'total_net_pay',
      label: t('Net Pay'),
      render: (value: number) => (
        <span className="font-mono text-blue-600">{window.appSettings?.formatCurrency(value)}</span>
      )
    },
    {
      key: 'status',
      label: t('Status'),
      render: (value: string) => {
        const statusColors = {
          draft: 'bg-gray-50 text-gray-700 ring-gray-600/20',
          processing: 'bg-yellow-50 text-yellow-700 ring-yellow-600/20',
          completed: 'bg-green-50 text-green-700 ring-green-600/20',
          cancelled: 'bg-red-50 text-red-700 ring-red-600/20'
        };
        return (
          <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${statusColors[value as keyof typeof statusColors]}`}>
            {t(value)}
          </span>
        );
      }
    }
  ];

  // Define table actions
  const actions = [
    {
      label: t('View Details'),
      icon: 'Eye',
      action: 'view',
      className: 'text-blue-500',
      requiredPermission: 'view-payroll-runs'
    },
    {
      label: t('Edit'),
      icon: 'Edit',
      action: 'edit',
      className: 'text-amber-500',
      requiredPermission: 'edit-payroll-runs',
      condition: (item: any) => item.status === 'draft'
    },
    {
      label: t('Process'),
      icon: 'Play',
      action: 'process',
      className: 'text-green-500',
      requiredPermission: 'process-payroll-runs',
      condition: (item: any) => item.status === 'draft'
    },
    {
      label: t('Print'),
      icon: 'Printer',
      action: 'print',
      className: 'text-purple-500',
      requiredPermission: 'view-payroll-runs',
      condition: (item: any) => item.status === 'completed'
    },
    {
      label: t('Download Payroll'),
      icon: 'Download',
      action: 'download',
      className: 'text-emerald-600',
      requiredPermission: 'view-payroll-runs',
      condition: (item: any) => item.status === 'completed'
    },
    {
      label: t('Delete'),
      icon: 'Trash2',
      action: 'delete',
      className: 'text-red-500',
      requiredPermission: 'delete-payroll-runs'
    }
  ];

  // Prepare options for filters
  const statusOptions = [
    { value: 'all', label: t('All Statuses'), disabled: true },
    { value: 'draft', label: t('Draft') },
    { value: 'processing', label: t('Processing') },
    { value: 'completed', label: t('Completed') },
    { value: 'cancelled', label: t('Cancelled') }
  ];

  return (
    <PageTemplate
      title={t("Payroll Runs")}
      url="/hr/payroll-runs"
      actions={pageActions}
      breadcrumbs={breadcrumbs}
      noPadding
    >
      {/* Search and filters section */}
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow mb-4 p-4">
        <SearchAndFilterBar
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          onSearch={handleSearch}
          filters={[
            {
              name: 'status',
              label: t('Status'),
              type: 'select',
              value: selectedStatus,
              onChange: setSelectedStatus,
              options: statusOptions
            },
            {
              name: 'date_from',
              label: t('Period From'),
              type: 'date',
              value: dateFrom,
              onChange: setDateFrom
            },
            {
              name: 'date_to',
              label: t('Period To'),
              type: 'date',
              value: dateTo,
              onChange: setDateTo
            }
          ]}
          showFilters={showFilters}
          setShowFilters={setShowFilters}
          hasActiveFilters={hasActiveFilters}
          activeFilterCount={activeFilterCount}
          onResetFilters={handleResetFilters}
          onApplyFilters={applyFilters}
          currentPerPage={pageFilters.per_page?.toString() || "50"}
          onPerPageChange={(value) => {
            router.get(route('hr.payroll-runs.index'), {
              page: 1,
              per_page: parseInt(value),
              search: searchTerm || undefined,
              status: selectedStatus !== 'all' ? selectedStatus : undefined,
              date_from: dateFrom || undefined,
              date_to: dateTo || undefined
            }, { preserveState: true, preserveScroll: true });
          }}
        />
      </div>

      {/* Content section */}
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow overflow-hidden">
        <CrudTable
          columns={columns}
          actions={actions}
          data={payrollRuns?.data || []}
          from={payrollRuns?.from || 1}
          onAction={handleAction}
          sortField={pageFilters.sort_field}
          sortDirection={pageFilters.sort_direction}
          onSort={handleSort}
          permissions={permissions}
          entityPermissions={{
            view: 'view-payroll-runs',
            create: 'create-payroll-runs',
            edit: 'edit-payroll-runs',
            delete: 'delete-payroll-runs'
          }}
        />

        {/* Pagination section */}
        <Pagination
          from={payrollRuns?.from || 0}
          to={payrollRuns?.to || 0}
          total={payrollRuns?.total || 0}
          links={payrollRuns?.links}
          entityName={t("payroll runs")}
          onPageChange={(url) => router.get(url)}
        />
      </div>

      {/* Form Modal */}
      <CrudFormModal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        onSubmit={handleFormSubmit}
        formConfig={{
          fields: [
            { name: 'title', label: t('Title'), type: 'text', required: true },
            {
              name: 'pay_period_start',
              label: t('Pay Period'),
              type: 'custom',
              required: true,
              render: renderPayPeriodRange
            }
          ],
          modalSize: 'lg'
        }}
        initialData={currentItem}
        title={
          formMode === 'create'
            ? t('Add New Payroll Run')
            : formMode === 'edit'
              ? t('Edit Payroll Run')
              : t('View Payroll Run')
        }
        mode={formMode}
      />

      <CrudFormModal
        isOpen={isProcessModalOpen}
        onClose={() => setIsProcessModalOpen(false)}
        onSubmit={handleProcessPayroll}
        formConfig={{
          fields: [
            {
              name: 'select_all',
              label: t('Select All Employees'),
              type: 'checkbox',
              placeholder: t('Run payroll for all active employees')
            },
            {
              name: 'employee_ids',
              label: t('Employees'),
              type: 'multi-select',
              placeholder: t('Search and select employees'),
              options: employees.map((employee: any) => ({
                value: String(employee.id),
                label: formatEmployeeOptionLabel(employee),
    searchText: getEmployeeSearchText(employee)
              })),
              dropdownHeight: '520px',
              conditional: (_mode: string, formData: any) => !formData.select_all
            }
          ],
          modalSize: 'lg'
        }}
        initialData={{ select_all: true, employee_ids: [] }}
        title={t('Process Payroll')}
        mode="create"
        description={t('Select all employees or choose specific employees for this payroll run.')}
      />

      {/* Delete Modal */}
      <CrudDeleteModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDeleteConfirm}
        itemName={currentItem?.title || ''}
        entityName="payroll run"
      />
    </PageTemplate>
  );
}
