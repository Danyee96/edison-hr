import { PageTemplate } from '@/components/page-template';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/components/custom-toast';
import { router, usePage } from '@inertiajs/react';
import { ArrowLeft } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

export default function EmployeeCreate() {
  const { t } = useTranslation();
  const { departments, nextEmployeeId = '', flash = {} } = usePage().props as any;
  const [formData, setFormData] = useState({ employee_id: String(nextEmployeeId || ''), name: '', department_id: '', whatsapp_number: '', salary: '', bonus: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isCheckingEmployeeId, setIsCheckingEmployeeId] = useState(false);
  const [isEmployeeIdAvailable, setIsEmployeeIdAvailable] = useState<boolean | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const formatPakistanWhatsAppNumber = (value: string) => {
    const digits = value.replace(/\D/g, '');
    if (!digits) return '';
    if (digits.startsWith('0092')) return `+${digits.slice(2)}`;
    if (digits.startsWith('92')) return `+${digits}`;
    if (digits.startsWith('0')) return `+92${digits.slice(1)}`;
    return `+92${digits}`;
  };

  const formatNumberInput = (value: string) => {
    if (value === '') return '';
    const amount = Number(value);
    if (Number.isNaN(amount)) return value;
    return Number.isInteger(amount) ? String(amount) : String(amount);
  };

  const handleChange = (name: 'employee_id' | 'name' | 'department_id' | 'whatsapp_number' | 'salary' | 'bonus', value: string) => {
    const nextValue = name === 'employee_id' ? value.replace(/\D/g, '') : value;
    setFormData((current) => ({ ...current, [name]: nextValue }));
    if (errors[name]) {
      setErrors((current) => {
        const next = { ...current };
        delete next[name];
        return next;
      });
    }
    if (name === 'employee_id') {
      setIsEmployeeIdAvailable(null);
    }
  };

  useEffect(() => {
    const employeeId = formData.employee_id.trim();

    if (!employeeId) {
      setIsCheckingEmployeeId(false);
      setIsEmployeeIdAvailable(null);
      setErrors((current) => {
        if (!current.employee_id) return current;
        const next = { ...current };
        delete next.employee_id;
        return next;
      });
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      setIsCheckingEmployeeId(true);

      fetch(route('hr.employees.check-employee-id', { employee_id: employeeId }), {
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      })
        .then((response) => (response.ok ? response.json() : Promise.reject(response)))
        .then((data) => {
          setIsEmployeeIdAvailable(Boolean(data.available));
          setErrors((current) => {
            const next = { ...current };
            if (data.available) {
              delete next.employee_id;
            } else {
              next.employee_id = data.message || t('Employee ID already exists.');
            }
            return next;
          });
        })
        .catch((error) => {
          if (error?.name !== 'AbortError') {
            setIsEmployeeIdAvailable(null);
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) {
            setIsCheckingEmployeeId(false);
          }
        });
    }, 350);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [formData.employee_id, t]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (errors.employee_id) {
      toast.error(errors.employee_id);
      return;
    }
    setIsSubmitting(true);

    router.post(route('hr.employees.store'), formData, {
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
        toast.error(t('Please correct the errors in the form'));
      },
      onFinish: () => setIsSubmitting(false),
    });
  };

  const breadcrumbs = [
    { title: t('Dashboard'), href: route('dashboard') },
    { title: t('Employees'), href: route('hr.employees.index') },
    { title: t('Create Employee') },
  ];

  return (
    <PageTemplate
      title={t('Create Employee')}
      url="/hr/employees/create"
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
              <Label htmlFor="employee_id">{t('Employee ID')}</Label>
              <Input
                id="employee_id"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={formData.employee_id}
                onChange={(event) => handleChange('employee_id', event.target.value)}
                className={errors.employee_id ? 'border-red-500' : ''}
              />
              {errors.employee_id && <p className="text-xs text-red-500">{errors.employee_id}</p>}
              {!errors.employee_id && isCheckingEmployeeId && (
                <p className="text-xs text-muted-foreground">{t('Checking employee ID...')}</p>
              )}
              {!errors.employee_id && isEmployeeIdAvailable && (
                <p className="text-xs text-green-600">{t('Employee ID is available.')}</p>
              )}
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
              <Button type="submit" disabled={isSubmitting || Boolean(errors.employee_id) || isCheckingEmployeeId}>
                {isSubmitting ? t('Saving...') : t('Save Employee')}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </PageTemplate>
  );
}
