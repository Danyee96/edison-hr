import { CrudDeleteModal } from '@/components/CrudDeleteModal';
import { CrudTable } from '@/components/CrudTable';
import { PageTemplate } from '@/components/page-template';
import { toast } from '@/components/custom-toast';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Pagination } from '@/components/ui/pagination';
import { SearchAndFilterBar } from '@/components/ui/search-and-filter-bar';
import { hasPermission } from '@/utils/authorization';
import { router, usePage } from '@inertiajs/react';
import { Download, Plus, Trash2, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

export default function Employees() {
  const { t } = useTranslation();
  const { auth, employees, departments, planLimits, filters: pageFilters = {} } = usePage().props as any;
  const permissions = auth?.permissions || [];

  const [searchTerm, setSearchTerm] = useState(pageFilters.search || '');
  const [selectedDepartment, setSelectedDepartment] = useState(pageFilters.department || 'all');
  const [showFilters, setShowFilters] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteMode, setDeleteMode] = useState<'single' | 'bulk'>('single');
  const [currentItem, setCurrentItem] = useState<any>(null);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<number[]>([]);
  const importInputRef = useRef<HTMLInputElement>(null);

  const visibleEmployeeIds = (employees?.data || []).map((employee: any) => Number(employee.id));
  const allVisibleSelected = visibleEmployeeIds.length > 0 && visibleEmployeeIds.every((id: number) => selectedEmployeeIds.includes(id));
  const canDeleteEmployees = hasPermission(permissions, 'delete-employees');

  const hasActiveFilters = () => selectedDepartment !== 'all' || searchTerm !== '';
  const activeFilterCount = () => (selectedDepartment !== 'all' ? 1 : 0) + (searchTerm ? 1 : 0);

  const filters = {
    page: 1,
    search: searchTerm || undefined,
    department: selectedDepartment !== 'all' ? selectedDepartment : undefined,
    per_page: pageFilters.per_page,
  };

  const applyFilters = () => {
    router.get(route('hr.employees.index'), filters, { preserveState: true, preserveScroll: true });
  };

  const handleSearch = (event: React.FormEvent) => {
    event.preventDefault();
    applyFilters();
  };

  const handleSort = (field: string) => {
    const direction = pageFilters.sort_field === field && pageFilters.sort_direction === 'asc' ? 'desc' : 'asc';

    router.get(
      route('hr.employees.index'),
      { ...filters, sort_field: field, sort_direction: direction },
      { preserveState: true, preserveScroll: true },
    );
  };

  const handleResetFilters = () => {
    setSearchTerm('');
    setSelectedDepartment('all');
    setShowFilters(false);
    router.get(route('hr.employees.index'), { page: 1, per_page: pageFilters.per_page }, { preserveState: true, preserveScroll: true });
  };

  const handleDepartmentChange = (department: string) => {
    setSelectedDepartment(department);
    router.get(
      route('hr.employees.index'),
      {
        ...filters,
        department: department !== 'all' ? department : undefined,
      },
      { preserveState: true, preserveScroll: true },
    );
  };

  const handleAction = (action: string, item: any) => {
    setCurrentItem(item);

    if (action === 'edit') {
      router.get(route('hr.employees.edit', item.employee?.id || item.id));
    }

    if (action === 'delete') {
      setDeleteMode('single');
      setIsDeleteModalOpen(true);
    }
  };

  const handleDeleteConfirm = () => {
    if (deleteMode === 'bulk') {
      toast.loading(t('Deleting employees...'));

      router.delete(route('hr.employees.bulk-destroy'), {
        data: { employee_ids: selectedEmployeeIds },
        preserveScroll: true,
        onSuccess: (page) => {
          setIsDeleteModalOpen(false);
          setSelectedEmployeeIds([]);
          toast.dismiss();
          if (page.props.flash.success) {
            toast.success(t(page.props.flash.success));
          } else if (page.props.flash.error) {
            toast.error(t(page.props.flash.error));
          }
        },
        onError: (errors) => {
          toast.dismiss();
          const firstError = Object.values(errors)[0];
          toast.error(typeof firstError === 'string' ? t(firstError) : t('Failed to delete employees'));
        },
      });
      return;
    }

    toast.loading(t('Deleting employee...'));

    router.delete(route('hr.employees.destroy', currentItem.id), {
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
        toast.error(typeof errors === 'string' ? t(errors) : t('Failed to delete employee'));
      },
    });
  };

  const toggleEmployeeSelection = (employeeId: number, checked: boolean) => {
    setSelectedEmployeeIds((current) => (
      checked
        ? [...new Set([...current, employeeId])]
        : current.filter((id) => id !== employeeId)
    ));
  };

  const toggleVisibleSelection = (checked: boolean) => {
    setSelectedEmployeeIds((current) => {
      if (!checked) {
        return current.filter((id) => !visibleEmployeeIds.includes(id));
      }

      return [...new Set([...current, ...visibleEmployeeIds])];
    });
  };

  const openBulkDeleteModal = () => {
    if (selectedEmployeeIds.length === 0) {
      toast.error(t('Please select at least one employee.'));
      return;
    }

    setDeleteMode('bulk');
    setCurrentItem({ name: `${selectedEmployeeIds.length} ${t('employees')}` });
    setIsDeleteModalOpen(true);
  };

  const handleImportFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    toast.loading(t('Importing employees...'));

    router.post(route('hr.employees.import'), formData, {
      forceFormData: true,
      preserveScroll: true,
      onSuccess: (page) => {
        toast.dismiss();
        if (page.props.flash.success) {
          toast.success(t(page.props.flash.success));
        } else if (page.props.flash.error) {
          toast.error(t(page.props.flash.error));
        }
      },
      onError: (errors) => {
        toast.dismiss();
        const firstError = Object.values(errors)[0];
        toast.error(typeof firstError === 'string' ? t(firstError) : t('Failed to import employees'));
      },
      onFinish: () => {
        if (importInputRef.current) {
          importInputRef.current.value = '';
        }
      },
    });
  };

  const exportEmployees = () => {
    window.location.href = route('hr.employees.export', {
      search: searchTerm || undefined,
      department: selectedDepartment !== 'all' ? selectedDepartment : undefined,
    });
  };

  const pageActions = [];
  if (hasPermission(permissions, 'view-employees')) {
    pageActions.push({
      label: t('Export Employees'),
      icon: <Download className="h-4 w-4 mr-2" />,
      variant: 'outline',
      onClick: exportEmployees,
    });
  }
  if (hasPermission(permissions, 'create-employees')) {
    const canCreate = !planLimits || planLimits.can_create;
    pageActions.push({
      label: t('Import Employee'),
      icon: <Upload className="h-4 w-4 mr-2" />,
      variant: 'outline',
      onClick: () => importInputRef.current?.click(),
    });
    pageActions.push({
      label: canCreate ? t('Add Employee') : t('Employee Limit Reached'),
      icon: <Plus className="h-4 w-4 mr-2" />,
      variant: canCreate ? 'default' : 'outline',
      onClick: canCreate
        ? () => router.get(route('hr.employees.create'))
        : () => toast.error(t('Employee limit exceeded. Please upgrade your plan.')),
      disabled: !canCreate,
    });
  }

  if (canDeleteEmployees && selectedEmployeeIds.length > 0) {
    pageActions.unshift({
      label: t('Delete Selected (:count)', { count: selectedEmployeeIds.length }),
      icon: <Trash2 className="h-4 w-4 mr-2" />,
      variant: 'destructive',
      onClick: openBulkDeleteModal,
    });
  }

  const departmentOptions = [
    { value: 'all', label: t('All Departments') },
    ...(departments || []).map((department: any) => ({
      value: department.id.toString(),
      label: department.name,
    })),
  ];

  const employeeNumber = (employee: any) => employee?.employee_id_display || employee?.employee_id || '-';

  const formatAmount = (value: any) => {
    if (value == null || value === '') return '-';

    const amount = Number(value);
    if (Number.isNaN(amount)) return value;

    return Number.isInteger(amount) ? String(amount) : String(amount);
  };

  const formatWhatsAppNumber = (value: any) => {
    const digits = String(value || '').replace(/\D/g, '');
    if (!digits) return '-';
    if (digits.startsWith('0092')) return `+${digits.slice(2)}`;
    if (digits.startsWith('92')) return `+${digits}`;
    if (digits.startsWith('0')) return `+92${digits.slice(1)}`;
    return `+92${digits}`;
  };

  const columns = [
    ...(canDeleteEmployees ? [
      {
        key: '__select',
        label: (
          <Checkbox
            checked={allVisibleSelected}
            onCheckedChange={(checked) => toggleVisibleSelection(Boolean(checked))}
            aria-label={t('Select all employees on this page')}
          />
        ),
        className: 'w-12',
        render: (_value: any, row: any) => (
          <Checkbox
            checked={selectedEmployeeIds.includes(Number(row.id))}
            onCheckedChange={(checked) => toggleEmployeeSelection(Number(row.id), Boolean(checked))}
            aria-label={t('Select employee')}
          />
        ),
      },
    ] : []),
    {
      key: 'employee_id',
      label: t('Employee ID'),
      sortable: true,
      render: (_value: any, row: any) => employeeNumber(row.employee),
    },
    {
      key: 'name',
      label: t('Name'),
      sortable: true,
      render: (_value: any, row: any) => <span className="font-medium">{row.name}</span>,
    },
    {
      key: 'department',
      label: t('Department'),
      render: (_value: any, row: any) => row.employee?.department?.name || '-',
    },
    {
      key: 'whatsapp_number',
      label: t('WhatsApp'),
      render: (_value: any, row: any) => formatWhatsAppNumber(row.employee?.whatsapp_number),
    },
    {
      key: 'salary',
      label: t('Salary'),
      render: (_value: any, row: any) => formatAmount(row.employee?.base_salary),
    },
    {
      key: 'bonus',
      label: t('Bonus'),
      render: (_value: any, row: any) => formatAmount(row.profile_bonus),
    },
  ];

  const actions = [
    {
      label: t('Edit'),
      icon: 'Edit',
      action: 'edit',
      className: 'text-amber-500',
      requiredPermission: 'edit-employees',
    },
    {
      label: t('Delete'),
      icon: 'Trash2',
      action: 'delete',
      className: 'text-red-500',
      requiredPermission: 'delete-employees',
    },
  ];

  const breadcrumbs = [
    { title: t('Dashboard'), href: route('dashboard') },
    { title: t('Employees') },
  ];

  return (
    <PageTemplate
      title={t('Employees')}
      url="/hr/employees"
      actions={pageActions}
      breadcrumbs={breadcrumbs}
      noPadding
    >
      <input
        ref={importInputRef}
        type="file"
        accept=".xlsx,.xlsm,.xltx,.xltm,.csv,.txt,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv,text/plain"
        className="hidden"
        onChange={handleImportFile}
      />

      <div className="mb-4 rounded-lg bg-white p-4 shadow">
        <SearchAndFilterBar
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          onSearch={handleSearch}
          inlineFilters={[
            {
              name: 'department',
              label: t('Department'),
              type: 'select',
              value: selectedDepartment,
              onChange: handleDepartmentChange,
              options: departmentOptions,
              searchable: true,
            },
          ]}
          showFilters={showFilters}
          setShowFilters={setShowFilters}
          hasActiveFilters={hasActiveFilters}
          activeFilterCount={activeFilterCount}
          onResetFilters={handleResetFilters}
          onApplyFilters={applyFilters}
          currentPerPage={pageFilters.per_page?.toString() || '50'}
          onPerPageChange={(value) => {
            router.get(
              route('hr.employees.index'),
              { ...filters, per_page: parseInt(value) },
              { preserveState: true, preserveScroll: true },
            );
          }}
        />
      </div>

      <div className="overflow-hidden rounded-lg bg-white shadow">
        {selectedEmployeeIds.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-blue-50 px-4 py-3 text-sm text-blue-900">
            <span className="font-medium">
              {selectedEmployeeIds.length} {t('employees selected')}
            </span>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setSelectedEmployeeIds([])}>
                {t('Clear Selection')}
              </Button>
              {canDeleteEmployees && (
                <Button type="button" variant="destructive" size="sm" onClick={openBulkDeleteModal}>
                  <Trash2 className="h-4 w-4" />
                  {t('Delete Selected')}
                </Button>
              )}
            </div>
          </div>
        )}
        <CrudTable
          columns={columns}
          actions={actions}
          data={employees?.data || []}
          from={employees?.from || 1}
          onAction={handleAction}
          sortField={pageFilters.sort_field}
          sortDirection={pageFilters.sort_direction}
          onSort={handleSort}
          permissions={permissions}
          showRowNumbers={false}
          entityPermissions={{
            view: 'view-employees',
            create: 'create-employees',
            edit: 'edit-employees',
            delete: 'delete-employees',
          }}
        />

        <Pagination
          from={employees?.from || 0}
          to={employees?.to || 0}
          total={employees?.total || 0}
          links={employees?.links}
          entityName={t('employees')}
          onPageChange={(url) => router.get(url)}
        />
      </div>

      <CrudDeleteModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDeleteConfirm}
        itemName={currentItem?.name || ''}
        entityName={deleteMode === 'bulk' ? 'employees' : 'employee'}
      />
    </PageTemplate>
  );
}
