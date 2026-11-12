import { CrudDeleteModal } from '@/components/CrudDeleteModal';
import { CrudFormModal } from '@/components/CrudFormModal';
import { CrudTable } from '@/components/CrudTable';
import { PageTemplate } from '@/components/page-template';
import { toast } from '@/components/custom-toast';
import { Pagination } from '@/components/ui/pagination';
import { SearchAndFilterBar } from '@/components/ui/search-and-filter-bar';
import { hasPermission } from '@/utils/authorization';
import { router, usePage } from '@inertiajs/react';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatEmployeeOptionLabel, getEmployeeSearchText } from '@/utils/helpers';

export default function Departments() {
  const { t } = useTranslation();
  const { auth, departments, employees, filters: pageFilters = {}, globalSettings } = usePage().props as any;
  const permissions = auth?.permissions || [];

  const [searchTerm, setSearchTerm] = useState(pageFilters.search || '');
  const [showFilters, setShowFilters] = useState(false);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [currentItem, setCurrentItem] = useState<any>(null);
  const [formMode, setFormMode] = useState<'create' | 'edit' | 'view'>('create');

  const hasActiveFilters = () => searchTerm !== '';
  const activeFilterCount = () => (searchTerm ? 1 : 0);

  const applyFilters = () => {
    router.get(
      route('hr.departments.index'),
      {
        page: 1,
        search: searchTerm || undefined,
        per_page: pageFilters.per_page,
      },
      { preserveState: true, preserveScroll: true },
    );
  };

  const handleSearch = (event: React.FormEvent) => {
    event.preventDefault();
    applyFilters();
  };

  const handleSort = (field: string) => {
    const direction = pageFilters.sort_field === field && pageFilters.sort_direction === 'asc' ? 'desc' : 'asc';

    router.get(
      route('hr.departments.index'),
      {
        sort_field: field,
        sort_direction: direction,
        page: 1,
        search: searchTerm || undefined,
        per_page: pageFilters.per_page,
      },
      { preserveState: true, preserveScroll: true },
    );
  };

  const handleAction = (action: string, item: any) => {
    setCurrentItem(item);

    if (action === 'edit') {
      setFormMode('edit');
      setIsFormModalOpen(true);
    }

    if (action === 'delete') {
      setIsDeleteModalOpen(true);
    }
  };

  const handleAddNew = () => {
    setCurrentItem(null);
    setFormMode('create');
    setIsFormModalOpen(true);
  };

  const handleFormSubmit = (formData: any) => {
    const isCreate = formMode === 'create';
    if (!globalSettings?.is_demo) {
      toast.loading(isCreate ? t('Creating department...') : t('Updating department...'));
    }

    const options = {
      onSuccess: (page: any) => {
        setIsFormModalOpen(false);
        if (!globalSettings?.is_demo) {
          toast.dismiss();
        }
        if (page.props.flash.success) {
          toast.success(t(page.props.flash.success));
        } else if (page.props.flash.error) {
          toast.error(t(page.props.flash.error));
        }
      },
      onError: (errors: any) => {
        if (!globalSettings?.is_demo) {
          toast.dismiss();
        }
        toast.error(typeof errors === 'string' ? t(errors) : t('Please correct the errors in the form'));
      },
    };

    if (isCreate) {
      router.post(route('hr.departments.store'), formData, options);
    } else {
      router.put(route('hr.departments.update', currentItem.id), formData, options);
    }
  };

  const handleDeleteConfirm = () => {
    if (!globalSettings?.is_demo) {
      toast.loading(t('Deleting department...'));
    }

    router.delete(route('hr.departments.destroy', currentItem.id), {
      onSuccess: (page) => {
        setIsDeleteModalOpen(false);
        if (!globalSettings?.is_demo) {
          toast.dismiss();
        }
        if (page.props.flash.success) {
          toast.success(t(page.props.flash.success));
        } else if (page.props.flash.error) {
          toast.error(t(page.props.flash.error));
        }
      },
      onError: (errors) => {
        if (!globalSettings?.is_demo) {
          toast.dismiss();
        }
        toast.error(typeof errors === 'string' ? t(errors) : t('Failed to delete department'));
      },
    });
  };

  const handleResetFilters = () => {
    setSearchTerm('');
    setShowFilters(false);
    router.get(route('hr.departments.index'), { page: 1, per_page: pageFilters.per_page }, { preserveState: true, preserveScroll: true });
  };

  const pageActions = [];
  if (hasPermission(permissions, 'create-departments')) {
    pageActions.push({
      label: t('Add Department'),
      icon: <Plus className="h-4 w-4 mr-2" />,
      variant: 'default',
      onClick: handleAddNew,
    });
  }

  const columns = [
    {
      key: 'name',
      label: t('Department'),
      sortable: true,
      render: (value: string) => <span className="font-medium">{value}</span>,
    },
    {
      key: 'employees_count',
      label: t('Persons'),
      sortable: true,
      render: (value: number) => value || 0,
    },
  ];

  const actions = [
    {
      label: t('Edit'),
      icon: 'Edit',
      action: 'edit',
      className: 'text-amber-500',
      requiredPermission: 'edit-departments',
    },
    {
      label: t('Delete'),
      icon: 'Trash2',
      action: 'delete',
      className: 'text-red-500',
      requiredPermission: 'delete-departments',
    },
  ];

  const employeeOptions = (employees || []).map((employee: any) => ({
    value: employee.id.toString(),
    label: formatEmployeeOptionLabel(employee),
    searchText: getEmployeeSearchText(employee),
  }));

  const formInitialData = currentItem
    ? {
        ...currentItem,
        employee_ids: (currentItem.employees || []).map((employee: any) => employee.user_id?.toString()).filter(Boolean),
      }
    : {};

  const breadcrumbs = [
    { title: t('Dashboard'), href: route('dashboard') },
    { title: t('Departments') },
  ];

  return (
    <PageTemplate
      title={t('Departments')}
      url="/hr/departments"
      actions={pageActions}
      breadcrumbs={breadcrumbs}
      noPadding
    >
      <div className="mb-4 rounded-lg bg-white p-4 shadow">
        <SearchAndFilterBar
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          onSearch={handleSearch}
          filters={[]}
          showFilters={showFilters}
          setShowFilters={setShowFilters}
          hasActiveFilters={hasActiveFilters}
          activeFilterCount={activeFilterCount}
          onResetFilters={handleResetFilters}
          onApplyFilters={applyFilters}
          currentPerPage={pageFilters.per_page?.toString() || '50'}
          onPerPageChange={(value) => {
            router.get(
              route('hr.departments.index'),
              { page: 1, per_page: parseInt(value), search: searchTerm || undefined },
              { preserveState: true, preserveScroll: true },
            );
          }}
        />
      </div>

      <div className="overflow-hidden rounded-lg bg-white shadow">
        <CrudTable
          columns={columns}
          actions={actions}
          data={departments?.data || []}
          from={departments?.from || 1}
          onAction={handleAction}
          sortField={pageFilters.sort_field}
          sortDirection={pageFilters.sort_direction}
          onSort={handleSort}
          permissions={permissions}
          entityPermissions={{
            view: 'view-departments',
            create: 'create-departments',
            edit: 'edit-departments',
            delete: 'delete-departments',
          }}
        />

        <Pagination
          from={departments?.from || 0}
          to={departments?.to || 0}
          total={departments?.total || 0}
          links={departments?.links}
          entityName={t('departments')}
          onPageChange={(url) => router.get(url)}
        />
      </div>

      <CrudFormModal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        onSubmit={handleFormSubmit}
        formConfig={{
          fields: [
            { name: 'name', label: t('Department'), type: 'text', required: true },
            {
              name: 'employee_ids',
              label: t('Assign Employees'),
              type: 'multi-select',
              options: employeeOptions,
              placeholder: t('Optional: select employees for this department'),
            },
          ],
          modalSize: 'lg',
        }}
        initialData={formInitialData}
        title={formMode === 'create' ? t('Add Department') : t('Edit Department')}
        description={t('Only the department name is required. Employee assignment is optional.')}
        mode={formMode}
      />

      <CrudDeleteModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDeleteConfirm}
        itemName={currentItem?.name || ''}
        entityName="department"
      />
    </PageTemplate>
  );
}
