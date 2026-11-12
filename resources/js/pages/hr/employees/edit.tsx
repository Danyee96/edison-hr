import { PageTemplate } from '@/components/page-template';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/components/custom-toast';
import { router, usePage } from '@inertiajs/react';
import { ArrowLeft } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

export default function EmployeeEdit() {
  const { t } = useTranslation();
  const { employee, departments, flash = {} } = usePage().props as any;
  const formatNumberInput = (value: any) => {
    if (value === null || value === undefined || value === '') return '';
    const amount = Number(value);
    if (Number.isNaN(amount)) return String(value);
    return Number.isInteger(amount) ? String(amount) : String(amount);
  };
  const [formData, setFormData] = useState({
    employee_id: employee.employee?.employee_id || '',
    name: employee.name || '',
    department_id: employee.employee?.department_id ? employee.employee.department_id.toString() : '',
    whatsapp_number: employee.employee?.whatsapp_number || '',
    salary: formatNumberInput(employee.employee?.base_salary),
    bonus: formatNumberInput(employee.profile_bonus),
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const formatPakistanWhatsAppNumber = (value: string) => {
    const digits = value.replace(/\D/g, '');
    if (!digits) return '';
    if (digits.startsWith('0092')) return `+${digits.slice(2)}`;
    if (digits.startsWith('92')) return `+${digits}`;
    if (digits.startsWith('0')) return `+92${digits.slice(1)}`;
    return `+92${digits}`;
  };

  const handleChange = (name: 'employee_id' | 'name' | 'department_id' | 'whatsapp_number' | 'salary' | 'bonus', value: string) => {
    setFormData((current) => ({ ...current, [name]: value }));
    if (errors[name]) {
      setErrors((current) => {
        const next = { ...current };
        delete next[name];
        return next;
      });
    }
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);

    router.put(route('hr.employees.update', employee.employee?.id), formData, {
      onSuccess: (page) => {
        setIsSubmitting(false);
        if (page.props.flash.success) {
          toast.success(t(page.props.flash.success));
        } else if (page.props.flash.error) {
          toast.error(t(page.props.flash.error));
        }
      },
      onError: (errors) => {
        setIsSubmitting(false);
        setErrors(errors);
        const firstError = Object.values(errors)[0];
        toast.error(typeof firstError === 'string' ? t(firstError) : t('Please correct the errors in the form'));
      },
      onFinish: () => {
        setIsSubmitting(false);
      },
    });
  };

  const breadcrumbs = [
    { title: t('Dashboard'), href: route('dashboard') },
    { title: t('Employees'), href: route('hr.employees.index') },
    { title: t('Edit Employee') },
  ];

  return (
    <PageTemplate
      title={t('Edit Employee')}
      url={`/hr/employees/${employee.id}/edit`}
      breadcrumbs={breadcrumbs}
      actions={[
        {
          label: t('Back to Employees'),
          icon: <ArrowLeft className="h-4 w-4 mr-2" />,
          variant: 'outline',
          onClick: () => router.get(route('hr.employees.index')),
        },
      ]}
    >
      <form onSubmit={handleSubmit} className="max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>{t('Employee Details')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {flash.error && (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {t(flash.error)}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="employee_id" required>{t('Employee ID')}</Label>
              <Input
                id="employee_id"
                required
                value={formData.employee_id}
                onChange={(event) => handleChange('employee_id', event.target.value)}
                className={errors.employee_id ? 'border-red-500' : ''}
              />
              {errors.employee_id && <p className="text-xs text-red-500">{errors.employee_id}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="name" required>{t('Name')}</Label>
              <Input
                id="name"
                autoFocus
                required
                value={formData.name}
                onChange={(event) => handleChange('name', event.target.value)}
                className={errors.name ? 'border-red-500' : ''}
              />
              {errors.name && <p className="text-xs text-red-500">{errors.name}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="department_id" required>{t('Department')}</Label>
              <Select
                value={formData.department_id}
                onValueChange={(value) => handleChange('department_id', value)}
              >
                <SelectTrigger id="department_id" className={errors.department_id ? 'border-red-500' : ''}>
                  <SelectValue placeholder={t('Select Department')} />
                </SelectTrigger>
                <SelectContent searchable>
                  {(departments || []).map((department: any) => (
                    <SelectItem key={department.id} value={department.id.toString()}>
                      {department.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.department_id && <p className="text-xs text-red-500">{errors.department_id}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="whatsapp_number">{t('WhatsApp Number')}</Label>
              <Input
                id="whatsapp_number"
                type="tel"
                placeholder={t('e.g. +923001234567')}
                value={formData.whatsapp_number}
                onChange={(event) => handleChange('whatsapp_number', event.target.value)}
                onBlur={(event) => handleChange('whatsapp_number', formatPakistanWhatsAppNumber(event.target.value))}
                className={errors.whatsapp_number ? 'border-red-500' : ''}
              />
              {errors.whatsapp_number && <p className="text-xs text-red-500">{errors.whatsapp_number}</p>}
            </div>

            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="salary">{t('Salary')}</Label>
                <Input
                  id="salary"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.salary}
                  onChange={(event) => handleChange('salary', event.target.value)}
                  onBlur={(event) => handleChange('salary', formatNumberInput(event.target.value))}
                  className={errors.salary ? 'border-red-500' : ''}
                />
                {errors.salary && <p className="text-xs text-red-500">{errors.salary}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="bonus">{t('Bonus')}</Label>
                <Input
                  id="bonus"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.bonus}
                  onChange={(event) => handleChange('bonus', event.target.value)}
                  onBlur={(event) => handleChange('bonus', formatNumberInput(event.target.value))}
                  className={errors.bonus ? 'border-red-500' : ''}
                />
                {errors.bonus && <p className="text-xs text-red-500">{errors.bonus}</p>}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => router.get(route('hr.employees.index'))}>
                {t('Cancel')}
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? t('Saving...') : t('Save Changes')}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </PageTemplate>
  );
}
