import { useState } from 'react';
import { PageTemplate } from '@/components/page-template';
import { CrudDeleteModal } from '@/components/CrudDeleteModal';
import { CrudFormModal } from '@/components/CrudFormModal';
import { CrudTable } from '@/components/CrudTable';
import { toast } from '@/components/custom-toast';
import { Pagination } from '@/components/ui/pagination';
import { hasPermission } from '@/utils/authorization';
import { router, usePage } from '@inertiajs/react';
import { Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatEmployeeOptionLabel, getEmployeeSearchText } from '@/utils/helpers';

export default function BonusManagement() {
  const { t } = useTranslation();
  const { auth, bonuses, employees } = usePage().props as any;
  const permissions = auth?.permissions || [];
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [mode, setMode] = useState<'create' | 'edit' | 'view'>('create');
  const [current, setCurrent] = useState<any>(null);

  const employeeOptions = (employees || []).map((employee: any) => ({ value: String(employee.id), label: formatEmployeeOptionLabel(employee),
    searchText: getEmployeeSearchText(employee) }));
  const typeOptions = [
    { value: 'performance', label: t('Performance Bonus') },
    { value: 'eid', label: t('Eid Bonus') },
    { value: 'annual', label: t('Annual Bonus') },
    { value: 'custom', label: t('Custom Bonus') },
  ];

  const submit = (formData: any) => {
    toast.loading(mode === 'create' ? t('Creating bonus...') : t('Updating bonus...'));
    const options = {
      onSuccess: (page: any) => {
        setIsFormOpen(false);
        toast.dismiss();
        page.props.flash?.success ? toast.success(t(page.props.flash.success)) : page.props.flash?.error && toast.error(t(page.props.flash.error));
      },
      onError: (errors: any) => {
        toast.dismiss();
        toast.error(Object.values(errors).join(', '));
      },
    };

    mode === 'create'
      ? router.post(route('hr.bonus-management.store'), formData, options)
      : router.put(route('hr.bonus-management.update', current.id), formData, options);
  };

  const actions = [
    { label: t('View'), icon: 'Eye', action: 'view', className: 'text-blue-500', requiredPermission: 'view-employee-bonuses' },
    { label: t('Edit'), icon: 'Edit', action: 'edit', className: 'text-amber-500', requiredPermission: 'edit-employee-bonuses' },
    { label: t('Delete'), icon: 'Trash2', action: 'delete', className: 'text-red-500', requiredPermission: 'delete-employee-bonuses' },
  ];

  return (
    <PageTemplate
      title={t('Bonus Management')}
      url="/hr/bonus-management"
      breadcrumbs={[{ title: t('Dashboard'), href: route('dashboard') }, { title: t('Bonus Management') }]}
      actions={hasPermission(permissions, 'create-employee-bonuses') ? [{ label: t('Add Bonus'), icon: <Plus className="mr-2 h-4 w-4" />, onClick: () => { setCurrent(null); setMode('create'); setIsFormOpen(true); } }] : []}
      noPadding
    >
      <div className="overflow-hidden rounded-lg bg-white shadow dark:bg-gray-900">
        <CrudTable
          columns={[
            { key: 'employee', label: t('Employee'), render: (_: any, row: any) => row.employee?.name || '-' },
            { key: 'bonus_type', label: t('Type'), render: (value: string) => typeOptions.find((type) => type.value === value)?.label || value },
            { key: 'amount', label: t('Amount'), render: (value: number) => window.appSettings?.formatCurrency?.(value) || `PKR ${Math.round(Number(value || 0)).toLocaleString('en-US')}` },
            { key: 'bonus_date', label: t('Bonus Date'), render: (value: string) => window.appSettings?.formatDateTimeSimple?.(value, false) || value },
            { key: 'notes', label: t('Notes'), render: (value: string) => value || '-' },
          ]}
          actions={actions}
          data={bonuses?.data || []}
          from={bonuses?.from || 1}
          permissions={permissions}
          onAction={(action, row) => { setCurrent(row); if (action === 'delete') setIsDeleteOpen(true); else { setMode(action as any); setIsFormOpen(true); } }}
          entityPermissions={{ view: 'view-employee-bonuses', create: 'create-employee-bonuses', edit: 'edit-employee-bonuses', delete: 'delete-employee-bonuses' }}
        />
        <Pagination from={bonuses?.from || 0} to={bonuses?.to || 0} total={bonuses?.total || 0} links={bonuses?.links} entityName={t('bonuses')} onPageChange={(url) => router.get(url)} />
      </div>

      <CrudFormModal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSubmit={submit}
        initialData={current}
        mode={mode}
        title={mode === 'create' ? t('Add Bonus') : mode === 'edit' ? t('Edit Bonus') : t('View Bonus')}
        formConfig={{ modalSize: 'lg', fields: [
          { name: 'employee_id', label: t('Employee'), type: 'select', required: true, searchable: true, options: employeeOptions },
          { name: 'bonus_type', label: t('Bonus Type'), type: 'select', required: true, options: typeOptions, defaultValue: 'custom' },
          { name: 'amount', label: t('Bonus Amount'), type: 'number', required: true },
          { name: 'bonus_date', label: t('Bonus Date'), type: 'date', required: true },
          { name: 'notes', label: t('Notes'), type: 'textarea' },
        ] }}
      />
      <CrudDeleteModal isOpen={isDeleteOpen} onClose={() => setIsDeleteOpen(false)} itemName={current?.employee?.name || ''} entityName="bonus" onConfirm={() => router.delete(route('hr.bonus-management.destroy', current.id), { onSuccess: () => setIsDeleteOpen(false) })} />
    </PageTemplate>
  );
}
