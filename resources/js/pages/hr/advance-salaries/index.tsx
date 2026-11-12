import { Fragment, useEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { PageTemplate } from '@/components/page-template';
import { CrudDeleteModal } from '@/components/CrudDeleteModal';
import { CrudFormModal } from '@/components/CrudFormModal';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Pagination } from '@/components/ui/pagination';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from '@/components/custom-toast';
import { router, usePage } from '@inertiajs/react';
import { Calendar as CalendarIcon, ChevronDown, ChevronLeft, ChevronRight, Download, Forward, Pencil, Plus, Search, Share2, Trash2, Upload } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatEmployeeOptionLabel, getEmployeeSearchText } from '@/utils/helpers';

const RECENT_ADVANCE_STORAGE_KEY = 'hr.recentAdvanceReceipt';
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const LONG_MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export default function AdvanceSalaries() {
  const { t } = useTranslation();
  const { advanceEmployees, employees, filters = {} } = usePage().props as any;
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deleteMode, setDeleteMode] = useState<'advance' | 'bulk'>('advance');
  const [mode, setMode] = useState<'create' | 'edit' | 'view'>('create');
  const [current, setCurrent] = useState<any>(null);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<number[]>([]);
  const [expandedRows, setExpandedRows] = useState<Record<number, boolean>>({});
  const [searchTerm, setSearchTerm] = useState(filters.search || '');
  const currentMonth = () => new Date().toISOString().slice(0, 7);
  const [selectedMonth, setSelectedMonth] = useState(filters.month || currentMonth());
  const [recentAdvance, setRecentAdvance] = useState<any>(null);
  const [recentReceiptUrl, setRecentReceiptUrl] = useState<string | null>(null);
  const [mobileEntriesEmployee, setMobileEntriesEmployee] = useState<any>(null);
  const [forwardEmployee, setForwardEmployee] = useState<any>(null);
  const [forwardDeductAmount, setForwardDeductAmount] = useState('');
  const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false);
  const [monthPickerYear, setMonthPickerYear] = useState(Number((filters.month || currentMonth()).slice(0, 4)));
  const [monthPanelStyle, setMonthPanelStyle] = useState<CSSProperties>({});
  const monthButtonRef = useRef<HTMLButtonElement>(null);
  const monthPanelRef = useRef<HTMLDivElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  const employeeOptions = (employees || []).map((employee: any) => ({
    value: String(employee.id),
    label: formatEmployeeOptionLabel(employee),
    searchText: getEmployeeSearchText(employee),
  }));
  const visibleEmployeeIds = (advanceEmployees?.data || []).map((employee: any) => Number(employee.id));
  const allVisibleSelected = visibleEmployeeIds.length > 0 && visibleEmployeeIds.every((id: number) => selectedEmployeeIds.includes(id));

  const formatMoney = (value: number | string | null | undefined) => {
    const amount = Number(value || 0);
    return window.appSettings?.formatCurrency?.(amount) || `PKR ${Math.round(amount).toLocaleString('en-US')}`;
  };

  const formatSignedMoney = (value: number | string | null | undefined) => {
    const amount = Number(value || 0);
    const formatted = formatMoney(Math.abs(amount));

    return amount < 0 ? `-${formatted}` : formatted;
  };

  const formatReceiptMoney = (value: number | string | null | undefined) => {
    return Math.round(Number(value || 0)).toLocaleString('en-US');
  };

  const formatDate = (value: string | null | undefined) => {
    if (!value) return '-';
    return window.appSettings?.formatDateTimeSimple?.(value, false) || value;
  };

  const formatMonthLabel = (value: string) => {
    const [year, month] = String(value || '').split('-').map(Number);
    return year && month ? `${LONG_MONTH_NAMES[month - 1]} ${year}` : t('Select month');
  };

  const addMonths = (value: string, count: number) => {
    const [year, month] = String(value || currentMonth()).split('-').map(Number);
    const date = new Date(year, (month || 1) - 1 + count, 1);

    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  };

  const selectMonth = (year: number, monthIndex: number) => {
    const nextMonth = `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
    setSelectedMonth(nextMonth);
    applyFilters(nextMonth);
    setIsMonthPickerOpen(false);
  };

  const formatReceiptDate = (value: string | null | undefined) => {
    if (!value) return '-';
    return new Date(`${value}T00:00:00`).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const generateAdvanceReceiptImage = async (employee: any, advance: any): Promise<File | null> => {
    const width = 1200;
    const height = 630;
    const scale = 2;
    const canvas = document.createElement('canvas');
    canvas.width = width * scale;
    canvas.height = height * scale;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return null;
    }

    ctx.scale(scale, scale);

    const centerX = width / 2;
    const fontFamily = 'Poppins, Arial, Helvetica, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    ctx.fillStyle = '#111827';
    ctx.font = `700 54px ${fontFamily}`;
    ctx.fillText(`Name: ${employee.name || '-'}`, centerX, 88, 1080);

    ctx.font = `700 46px ${fontFamily}`;
    ctx.fillText(`Dept: ${employee.department_name || '-'}`, centerX, 150, 1080);

    ctx.font = `700 64px ${fontFamily}`;
    ctx.fillText('Advance taken', centerX, 235);

    ctx.fillStyle = '#dc2626';
    ctx.font = `800 86px ${fontFamily}`;
    ctx.fillText(`Rs ${formatReceiptMoney(advance.amount)}`, centerX, 325);

    ctx.fillStyle = '#111827';
    ctx.font = `600 42px ${fontFamily}`;
    ctx.fillText(formatReceiptDate(advance.request_date), centerX, 390);

    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(210, 455);
    ctx.lineTo(990, 455);
    ctx.stroke();

    ctx.font = `700 44px ${fontFamily}`;
    ctx.fillText('Total Advance taken this month:', centerX, 515, 1080);

    ctx.fillStyle = '#dc2626';
    ctx.font = `800 66px ${fontFamily}`;
    ctx.fillText(`Rs ${formatReceiptMoney(employee.advance_total)}`, centerX, 580);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png', 1));
    if (!blob) {
      return null;
    }

    const safeName = String(employee.name || 'employee').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();
    return new File([blob], `advance-${safeName || 'employee'}-${advance.request_date || 'receipt'}.png`, { type: 'image/png' });
  };

  const downloadReceiptImage = (file: File) => {
    const url = URL.createObjectURL(file);
    const link = document.createElement('a');
    link.href = url;
    link.download = file.name;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const normalizeWhatsAppNumber = (value: string | null | undefined) => {
    const digits = String(value || '').replace(/\D/g, '');
    if (!digits) {
      return '';
    }

    if (digits.startsWith('0092')) {
      return digits.slice(2);
    }

    if (digits.startsWith('92')) {
      return digits;
    }

    return digits.startsWith('0') ? `92${digits.slice(1)}` : `92${digits}`;
  };

  const openWhatsAppChat = (employee: any) => {
    const number = normalizeWhatsAppNumber(employee?.whatsapp_number);
    window.open(number ? `https://wa.me/${number}` : 'https://wa.me/', '_blank', 'noopener,noreferrer');
  };

  const openWhatsAppMessage = (employee: any, message: string) => {
    const number = normalizeWhatsAppNumber(employee?.whatsapp_number);
    const encodedMessage = encodeURIComponent(message);
    window.open(number ? `https://wa.me/${number}?text=${encodedMessage}` : `https://wa.me/?text=${encodedMessage}`, '_blank', 'noopener,noreferrer');
  };

  const buildAdvanceShareText = (employee: any, advance: any) => {
    const receiptUrl = advance?.receipt_url
      ? new URL(advance.receipt_url, window.location.origin).toString()
      : '';
    const lines = [
      `Name: ${employee?.name || '-'}`,
      `Dept: ${employee?.department_name || '-'}`,
      `Advance taken: Rs ${formatReceiptMoney(advance?.amount)}`,
      `Date: ${formatReceiptDate(advance?.request_date)}`,
      `Total advance taken this month: Rs ${formatReceiptMoney(employee?.advance_total)}`,
    ];

    if (receiptUrl) {
      lines.push('', `Receipt: ${receiptUrl}`);
    }

    return lines.join('\n');
  };

  const shareAdvanceOnWhatsApp = async (employee: any, advance: any) => {
    if (advance?.receipt_url) {
      openWhatsAppMessage(employee, buildAdvanceShareText(employee, advance));
      return;
    }

    const receiptImage = await generateAdvanceReceiptImage(employee, advance);
    const whatsappNumber = normalizeWhatsAppNumber(employee?.whatsapp_number);

    if (whatsappNumber) {
      if (receiptImage) {
        downloadReceiptImage(receiptImage);
      }

      window.open(`https://wa.me/${whatsappNumber}`, '_blank', 'noopener,noreferrer');
      return;
    }

    const shareData = receiptImage
      ? {
          files: [receiptImage],
          title: 'Salary Advance',
          text: `Salary advance receipt for ${employee?.name || 'employee'}`,
        }
      : null;

    if (shareData && navigator.canShare?.(shareData)) {
      try {
        await navigator.share(shareData);
        return;
      } catch (error) {
        if ((error as DOMException)?.name === 'AbortError') {
          return;
        }
      }
    }

    if (receiptImage) {
      downloadReceiptImage(receiptImage);
    }

    openWhatsAppChat(employee);
  };

  const downloadAdvanceReceiptImage = async (employee: any, advance: any) => {
    const receiptImage = await generateAdvanceReceiptImage(employee, advance);
    if (receiptImage) {
      downloadReceiptImage(receiptImage);
    }
  };

  const getRecentAdvanceContext = () => {
    if (!recentAdvance) {
      return null;
    }

    const employeeId = Number(recentAdvance.employee_id);
    const employeeRow = (advanceEmployees?.data || []).find((employee: any) => Number(employee.id) === employeeId);
    const matchedAdvance = employeeRow?.advances?.find((advance: any) => (
      Number(advance.amount) === Number(recentAdvance.amount)
      && advance.request_date === recentAdvance.request_date
    ));
    const employeeOption = (employees || []).find((employee: any) => Number(employee.id) === employeeId);
    const fallbackEmployee = {
      id: employeeId,
      name: employeeOption?.name || '-',
      department_name: '-',
      whatsapp_number: employeeOption?.whatsapp_number || '',
      advance_total: Number(recentAdvance.amount || 0),
    };

    return {
      employee: employeeRow || fallbackEmployee,
      advance: matchedAdvance || recentAdvance,
    };
  };

  const getEmployeeAdvanceSummary = (employeeId: any) => {
    if (!employeeId) {
      return null;
    }

    const id = Number(employeeId);
    const employee = (employees || []).find((item: any) => Number(item.id) === id);
    const listedEmployee = (advanceEmployees?.data || []).find((item: any) => Number(item.id) === id);

    if (!employee && !listedEmployee) {
      return null;
    }

    return {
      name: employee?.name || listedEmployee?.name || '-',
      employee_code: employee?.employee_code || listedEmployee?.employee_code || '-',
      salary: Number(employee?.salary ?? listedEmployee?.salary ?? 0),
      advance_total: Number(listedEmployee?.advance_total ?? employee?.advance_total ?? 0),
    };
  };

  const getAdvanceWarning = (formData: any) => {
    const summary = getEmployeeAdvanceSummary(formData.employee_id);
    const requestedAmount = Number(formData.amount || 0);

    if (!summary || requestedAmount <= 0) {
      return null;
    }

    const currentAdvanceAmount = mode === 'edit' && Number(current?.employee_id) === Number(formData.employee_id)
      ? Number(current?.amount || 0)
      : 0;
    const alreadyTaken = Math.max(0, Number(summary.advance_total || 0) - currentAdvanceAmount);
    const availableAmount = Number(summary.salary || 0) - alreadyTaken;
    const totalAfterAdvance = alreadyTaken + requestedAmount;

    if (requestedAmount > Number(summary.salary || 0)) {
      return {
        title: t('Warning: advance is greater than base salary.'),
        detail: `${t('Base Salary')}: ${formatMoney(summary.salary)} · ${t('Requested')}: ${formatMoney(requestedAmount)}`,
      };
    }

    if (requestedAmount > availableAmount) {
      return {
        title: t('Warning: advance is greater than remaining salary after already taken advances.'),
        detail: `${t('Already Taken Advance')}: ${formatMoney(alreadyTaken)} · ${t('Available')}: ${formatMoney(Math.max(0, availableAmount))} · ${t('After this')}: ${formatMoney(totalAfterAdvance)}`,
      };
    }

    return null;
  };

  const calculateInstallmentMonths = (amount: any, monthlyAmount: any) => {
    const advanceAmount = Number(amount || 0);
    const maxMonthlyAmount = Number(monthlyAmount || 0);

    if (advanceAmount <= 0 || maxMonthlyAmount <= 0) {
      return '';
    }

    return Math.ceil(advanceAmount / maxMonthlyAmount);
  };

  const updateInstallmentMonths = (nextData: any, handleChange: (name: string, value: any) => void) => {
    if (nextData.repayment_type !== 'installment') {
      return;
    }

    const months = calculateInstallmentMonths(nextData.amount, nextData.monthly_installment_amount);

    if (months) {
      handleChange('installment_months', months);
    }
  };

  const getRepaymentSummary = (advance: any) => {
    const source = advance.repayment_source === 'bonus' ? t('Bonus') : t('Salary');

    if (advance.repayment_type !== 'installment') {
      return `${t('Full')} · ${source}`;
    }

    return `${advance.installment_months || '-'} ${t('months')} · ${formatMoney(advance.monthly_installment_amount)} ${t('/ month')} · ${source}`;
  };

  const openCreateForm = (employee?: any) => {
    const today = new Date().toISOString().split('T')[0];
    const defaultDate = today.startsWith(selectedMonth) ? today : `${selectedMonth}-01`;
    const defaults = {
      request_date: defaultDate,
      repayment_type: 'full',
      repayment_source: 'salary',
    };
    setCurrent(employee ? { ...defaults, employee_id: String(employee.id) } : defaults);
    setMode('create');
    setIsFormOpen(true);
  };

  const applyFilters = (month = selectedMonth, search = searchTerm) => {
    router.get(route('hr.advance-salaries.index'), {
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

  const openEditForm = (advance: any) => {
    setCurrent(advance);
    setMode('edit');
    setIsFormOpen(true);
  };

  const openDeleteModal = (advance: any) => {
    setDeleteMode('advance');
    setCurrent(advance);
    setIsDeleteOpen(true);
  };

  const openBulkDeleteModal = () => {
    if (selectedEmployeeIds.length === 0) {
      return;
    }

    setDeleteMode('bulk');
    setCurrent({
      employee_name: `${selectedEmployeeIds.length} ${t('employees')}`,
      employee_ids: selectedEmployeeIds,
    });
    setIsDeleteOpen(true);
  };

  const openForwardModal = (employee: any) => {
    setForwardEmployee(employee);
    setForwardDeductAmount(String(Math.max(0, Number(employee?.advance_total || 0))));
  };

  const closeForwardModal = () => {
    setForwardEmployee(null);
    setForwardDeductAmount('');
  };

  const submitForwardBalance = (event: React.FormEvent) => {
    event.preventDefault();

    if (!forwardEmployee) {
      return;
    }

    router.post(route('hr.advance-salaries.forward-balance', forwardEmployee.id), {
      month: selectedMonth || currentMonth(),
      deduct_amount: Number(forwardDeductAmount || 0),
    }, {
      preserveScroll: true,
      onSuccess: (page: any) => {
        closeForwardModal();
        if (page.props.flash?.success) toast.success(t(page.props.flash.success));
        if (page.props.flash?.error) toast.error(t(page.props.flash.error));
        applyFilters();
      },
      onError: (errors: any) => {
        toast.error(typeof errors === 'string' ? errors : Object.values(errors).join(', '));
      },
    });
  };

  const toggleEmployeeSelection = (employeeId: number, checked: boolean) => {
    setSelectedEmployeeIds((ids) => (
      checked ? Array.from(new Set([...ids, employeeId])) : ids.filter((id) => id !== employeeId)
    ));
  };

  const toggleAllVisibleEmployees = (checked: boolean) => {
    setSelectedEmployeeIds((ids) => {
      if (!checked) {
        return ids.filter((id) => !visibleEmployeeIds.includes(id));
      }

      return Array.from(new Set([...ids, ...visibleEmployeeIds]));
    });
  };

  const confirmDelete = () => {
    const commonOptions = {
      preserveScroll: true,
      onSuccess: (page: any) => {
        setIsDeleteOpen(false);
        if (page.props.flash?.success) toast.success(t(page.props.flash.success));
        if (page.props.flash?.error) toast.error(t(page.props.flash.error));
        if (deleteMode === 'bulk') {
          setSelectedEmployeeIds([]);
        }
      },
      onError: (errors: any) => {
        toast.error(typeof errors === 'string' ? errors : Object.values(errors).join(', '));
      },
    };

    if (deleteMode === 'bulk') {
      router.delete(route('hr.advance-salaries.bulk-destroy'), {
        ...commonOptions,
        data: { employee_ids: current.employee_ids || selectedEmployeeIds },
      });
      return;
    }

    router.delete(route('hr.advance-salaries.destroy', current.id), commonOptions);
  };

  const handleImportFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const importMonth = selectedMonth || currentMonth();
    const formData = new FormData();
    formData.append('file', file);
    formData.append('month', importMonth);

    toast.loading(t('Importing salary advances...'));

    router.post(route('hr.advance-salaries.import'), formData, {
      forceFormData: true,
      preserveScroll: true,
      onSuccess: (page: any) => {
        toast.dismiss();
        if (page.props.flash?.success) toast.success(t(page.props.flash.success));
        if (page.props.flash?.error) toast.error(t(page.props.flash.error));
        setSelectedMonth(importMonth);
        applyFilters(importMonth);
      },
      onError: (errors: any) => {
        toast.dismiss();
        toast.error(typeof errors === 'string' ? errors : Object.values(errors).join(', '));
      },
      onFinish: () => {
        event.target.value = '';
      },
    });
  };

  const exportSalarySheet = (format: 'xlsx' | 'pdf') => {
    const params = new URLSearchParams({
      month: selectedMonth || currentMonth(),
      format,
    });

    if (searchTerm) {
      params.set('search', searchTerm);
    }

    window.location.href = `${route('hr.advance-salaries.export')}?${params.toString()}`;
  };

  const submitAdvance = (formData: any) => {
    if (mode === 'create') {
      const employeeId = Number(formData.employee_id);
      const savedAdvance = {
        ...formData,
        employee_id: employeeId,
        amount: Number(formData.amount || 0),
      };

      window.sessionStorage.setItem(RECENT_ADVANCE_STORAGE_KEY, JSON.stringify(savedAdvance));

      router.post(route('hr.advance-salaries.store'), formData, {
        preserveState: true,
        onSuccess: () => {
          setIsFormOpen(false);
          setRecentAdvance(savedAdvance);
          if (employeeId) {
            setExpandedRows((rows) => ({ ...rows, [employeeId]: true }));
          }
        },
        onError: () => {
          window.sessionStorage.removeItem(RECENT_ADVANCE_STORAGE_KEY);
        },
      });
      return;
    }

    router.put(route('hr.advance-salaries.update', current.id), formData, {
      onSuccess: () => setIsFormOpen(false),
    });
  };

  const recentAdvanceContext = getRecentAdvanceContext();
  const forwardCurrentTotal = Number(forwardEmployee?.advance_total || 0);
  const forwardDeductNumber = Number(forwardDeductAmount || 0);
  const forwardBalanceAmount = Math.max(0, forwardCurrentTotal - forwardDeductNumber);
  const forwardAmountInvalid = forwardDeductNumber < 0 || forwardDeductNumber > forwardCurrentTotal;
  const forwardNextMonthLabel = formatMonthLabel(addMonths(selectedMonth || currentMonth(), 1));
  const forwardRealEntries = (forwardEmployee?.advances || []).filter((advance: any) => !advance.is_virtual_repayment);

  useEffect(() => {
    const savedAdvance = window.sessionStorage.getItem(RECENT_ADVANCE_STORAGE_KEY);
    if (!savedAdvance) {
      return;
    }

    try {
      setRecentAdvance(JSON.parse(savedAdvance));
    } catch {
      window.sessionStorage.removeItem(RECENT_ADVANCE_STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    if (recentAdvance) {
      window.sessionStorage.removeItem(RECENT_ADVANCE_STORAGE_KEY);
    }
  }, [recentAdvance]);

  useEffect(() => {
    let objectUrl: string | null = null;
    let isActive = true;
    const context = getRecentAdvanceContext();

    setRecentReceiptUrl(null);

    if (!context) {
      return undefined;
    }

    generateAdvanceReceiptImage(context.employee, context.advance).then((file) => {
      if (!file || !isActive) {
        return;
      }

      objectUrl = URL.createObjectURL(file);
      setRecentReceiptUrl(objectUrl);
    });

    return () => {
      isActive = false;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [recentAdvance, advanceEmployees]);

  useEffect(() => {
    if (selectedMonth) {
      setMonthPickerYear(Number(selectedMonth.slice(0, 4)));
    }
  }, [selectedMonth]);

  useEffect(() => {
    if (!isMonthPickerOpen) {
      return undefined;
    }

    const updatePosition = () => {
      const rect = monthButtonRef.current?.getBoundingClientRect();
      if (!rect) {
        return;
      }

      const width = Math.min(Math.max(rect.width, 320), window.innerWidth - 24);
      const left = Math.min(Math.max(12, rect.left), window.innerWidth - width - 12);

      setMonthPanelStyle({
        left,
        top: rect.bottom + 8,
        width,
        position: 'fixed',
        zIndex: 70000,
      });
    };

    const close = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!monthButtonRef.current?.contains(target) && !monthPanelRef.current?.contains(target)) {
        setIsMonthPickerOpen(false);
      }
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    document.addEventListener('mousedown', close);

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
      document.removeEventListener('mousedown', close);
    };
  }, [isMonthPickerOpen]);

  return (
    <PageTemplate
      title={t('Salary Advance')}
      url="/hr/advance-salaries"
      breadcrumbs={[{ title: t('Dashboard'), href: route('dashboard') }, { title: t('Salary Advance') }]}
      actions={[
        { label: t('Import File'), icon: <Upload className="mr-2 h-4 w-4" />, onClick: () => importInputRef.current?.click() },
        { label: t('Export Excel'), icon: <Download className="mr-2 h-4 w-4" />, onClick: () => exportSalarySheet('xlsx') },
        { label: t('Export PDF'), icon: <Download className="mr-2 h-4 w-4" />, onClick: () => exportSalarySheet('pdf') },
        { label: t('Add New Advance'), icon: <Plus className="mr-2 h-4 w-4" />, onClick: () => openCreateForm() },
      ]}
      noPadding
    >
      <input
        ref={importInputRef}
        className="hidden"
        type="file"
        accept=".xlsx,.xls,.csv,.txt,.pdf,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
        onChange={handleImportFile}
      />
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
            <div className="grid grid-cols-[44px_minmax(0,1fr)_44px] gap-2 lg:flex lg:shrink-0 lg:flex-nowrap lg:items-center lg:justify-end">
              <Button type="button" variant="outline" size="icon" className="h-11 w-11" onClick={() => changeMonth(-1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                ref={monthButtonRef}
                type="button"
                variant="outline"
                className="h-11 min-w-0 justify-between px-4 text-left text-base font-normal lg:w-60"
                onClick={() => setIsMonthPickerOpen((open) => !open)}
              >
                <span className="truncate">{formatMonthLabel(selectedMonth)}</span>
                <CalendarIcon className="ml-3 h-4 w-4 shrink-0" />
              </Button>
              <Button type="button" variant="outline" size="icon" className="h-11 w-11" onClick={() => changeMonth(1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button type="submit" className="col-span-3 h-11 justify-center text-white hover:text-white lg:col-span-1">
                <Search className="h-4 w-4" />
                {t('Search')}
              </Button>
            </div>
          </form>
        </div>
        {isMonthPickerOpen && createPortal(
          <div
            ref={monthPanelRef}
            style={monthPanelStyle}
            className="rounded-xl border border-slate-200 bg-white p-3 text-slate-950 shadow-2xl dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
          >
            <div className="flex items-center justify-between rounded-lg bg-slate-50 px-2 py-2 dark:bg-gray-800">
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => setMonthPickerYear((year) => year - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="text-lg font-semibold">{monthPickerYear}</div>
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => setMonthPickerYear((year) => year + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {MONTH_NAMES.map((month, index) => {
                const monthValue = `${monthPickerYear}-${String(index + 1).padStart(2, '0')}`;
                const isSelected = monthValue === selectedMonth;

                return (
                  <Button
                    key={month}
                    type="button"
                    variant={isSelected ? 'default' : 'ghost'}
                    className={`h-10 text-base ${isSelected ? 'text-white hover:text-white' : ''}`}
                    onClick={() => selectMonth(monthPickerYear, index)}
                  >
                    {month}
                  </Button>
                );
              })}
            </div>
            <div className="mt-3 flex items-center justify-between border-t pt-3">
              <Button
                type="button"
                variant="ghost"
                className="text-primary"
                onClick={() => {
                  setSelectedMonth('');
                  applyFilters('');
                  setIsMonthPickerOpen(false);
                }}
              >
                {t('Clear')}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="text-primary"
                onClick={() => {
                  const today = currentMonth();
                  setMonthPickerYear(Number(today.slice(0, 4)));
                  setSelectedMonth(today);
                  applyFilters(today);
                  setIsMonthPickerOpen(false);
                }}
              >
                {t('This month')}
              </Button>
            </div>
          </div>,
          document.body
        )}
        {selectedEmployeeIds.length > 0 && (
          <div className="flex flex-col gap-3 border-b bg-red-50 px-4 py-3 text-sm text-red-900 sm:flex-row sm:items-center sm:justify-between">
            <div className="font-medium">
              {selectedEmployeeIds.length} {t('employees selected')}
            </div>
            <Button type="button" variant="destructive" size="sm" className="justify-center" onClick={openBulkDeleteModal}>
              <Trash2 className="h-4 w-4" />
              {t('Delete Selected Advances')}
            </Button>
          </div>
        )}
        <div className="hidden lg:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={allVisibleSelected}
                    onCheckedChange={(checked) => toggleAllVisibleEmployees(Boolean(checked))}
                    aria-label={t('Select all employees')}
                  />
                </TableHead>
                <TableHead className="w-12" />
                <TableHead>{t('Employee ID')}</TableHead>
                <TableHead>{t('Employee')}</TableHead>
                <TableHead>{t('Department')}</TableHead>
                <TableHead>{t('Actual Salary')}</TableHead>
                <TableHead>{t('Advance Taken')}</TableHead>
                <TableHead>{t('Advance Date')}</TableHead>
                <TableHead>{t('Remaining Salary')}</TableHead>
                <TableHead>{t('Entries')}</TableHead>
                <TableHead className="text-right">{t('Actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(advanceEmployees?.data || []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={11} className="py-10 text-center text-muted-foreground">
                    {t('No salary advances found')}
                  </TableCell>
                </TableRow>
              )}

              {(advanceEmployees?.data || []).map((employee: any) => {
                const isExpanded = expandedRows[employee.id] ?? false;
                const entries = employee.advances || [];
                const latestAdvance = entries.find((advance: any) => !advance.is_virtual_repayment);
                const isSelected = selectedEmployeeIds.includes(Number(employee.id));

                return (
                  <Fragment key={employee.id}>
                    <TableRow>
                      <TableCell>
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={(checked) => toggleEmployeeSelection(Number(employee.id), Boolean(checked))}
                          aria-label={`${t('Select')} ${employee.name}`}
                        />
                      </TableCell>
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
                      <TableCell>{employee.department_name || '-'}</TableCell>
                      <TableCell>{formatMoney(employee.salary)}</TableCell>
                      <TableCell>{formatMoney(employee.advance_total)}</TableCell>
                      <TableCell>{formatDate(employee.latest_advance_date)}</TableCell>
                      <TableCell className={`font-semibold ${Number(employee.remaining_salary || 0) < 0 ? 'text-red-600' : 'text-primary'}`}>
                        {formatSignedMoney(employee.remaining_salary)}
                      </TableCell>
                      <TableCell>{entries.length}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-wrap justify-end gap-2">
                          {latestAdvance && (
                            <>
                              <Button type="button" size="sm" variant="outline" onClick={() => shareAdvanceOnWhatsApp(employee, latestAdvance)}>
                                <Share2 className="h-4 w-4" />
                                {t('WhatsApp')}
                              </Button>
                              <Button type="button" size="sm" variant="outline" onClick={() => downloadAdvanceReceiptImage(employee, latestAdvance)}>
                                <Download className="h-4 w-4" />
                                {t('Download')}
                              </Button>
                            </>
                          )}
                          <Button type="button" size="sm" variant="outline" onClick={() => openCreateForm(employee)}>
                            <Plus className="h-4 w-4" />
                            {t('Add New')}
                          </Button>
                          {Number(employee.advance_total || 0) > 0 && (
                            <Button type="button" size="sm" variant="outline" onClick={() => openForwardModal(employee)}>
                              <Forward className="h-4 w-4" />
                              {t('Forward Balance')}
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>

                    {isExpanded && (
                      <TableRow className="bg-muted/30 hover:bg-muted/30">
                        <TableCell />
                        <TableCell />
                        <TableCell colSpan={9} className="p-0">
                          <div className="px-4 py-3">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>{t('Advance Amount')}</TableHead>
                                  <TableHead>{t('Status')}</TableHead>
                                  <TableHead>{t('Repayment')}</TableHead>
                                  <TableHead>{t('Outstanding')}</TableHead>
                                  <TableHead>{t('Date')}</TableHead>
                                  <TableHead>{t('Notes')}</TableHead>
                                  <TableHead className="text-right">{t('Actions')}</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {entries.map((advance: any) => (
                                  <TableRow key={advance.id}>
                                    <TableCell>{formatMoney(advance.amount)}</TableCell>
                                    <TableCell>
                                      <span className={advance.is_virtual_repayment ? 'font-semibold text-blue-600' : 'text-muted-foreground'}>
                                        {advance.status_label || (advance.is_virtual_repayment ? t('Loan repayment') : t('Advance taken'))}
                                      </span>
                                    </TableCell>
                                    <TableCell>{getRepaymentSummary(advance)}</TableCell>
                                    <TableCell>{formatMoney(advance.outstanding_amount)}</TableCell>
                                    <TableCell>{formatDate(advance.request_date)}</TableCell>
                                    <TableCell>{advance.notes || '-'}</TableCell>
                                    <TableCell className="text-right">
                                      <div className="flex justify-end gap-2">
                                        {!advance.is_virtual_repayment && (
                                          <>
                                            <Button
                                              type="button"
                                              variant="ghost"
                                              size="icon"
                                              className="h-8 w-8 text-green-600"
                                              title={t('WhatsApp')}
                                              onClick={() => shareAdvanceOnWhatsApp(employee, advance)}
                                            >
                                              <Share2 className="h-4 w-4" />
                                            </Button>
                                            <Button
                                              type="button"
                                              variant="ghost"
                                              size="icon"
                                              className="h-8 w-8 text-blue-600"
                                              title={t('Download')}
                                              onClick={() => downloadAdvanceReceiptImage(employee, advance)}
                                            >
                                              <Download className="h-4 w-4" />
                                            </Button>
                                            <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditForm(advance)}>
                                              <Pencil className="h-4 w-4" />
                                            </Button>
                                            <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-red-600" onClick={() => openDeleteModal({ ...advance, employee_name: employee.name })}>
                                              <Trash2 className="h-4 w-4" />
                                            </Button>
                                          </>
                                        )}
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
        </div>

        <div className="space-y-3 p-3 lg:hidden">
          {(advanceEmployees?.data || []).length === 0 && (
            <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
              {t('No salary advances found')}
            </div>
          )}

          {(advanceEmployees?.data || []).map((employee: any) => {
            const entries = employee.advances || [];
            const latestAdvance = entries.find((advance: any) => !advance.is_virtual_repayment);
            const isSelected = selectedEmployeeIds.includes(Number(employee.id));

            return (
              <div key={employee.id} className="rounded-lg border bg-white p-4 shadow-sm dark:bg-gray-900">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={(checked) => toggleEmployeeSelection(Number(employee.id), Boolean(checked))}
                      aria-label={`${t('Select')} ${employee.name}`}
                      className="mt-1"
                    />
                    <div className="min-w-0">
                      <div className="text-xs font-medium uppercase text-muted-foreground">{t('Employee ID')} {employee.employee_code || '-'}</div>
                      <div className="mt-1 truncate text-base font-semibold text-gray-950 dark:text-gray-100">{employee.name}</div>
                      <div className="mt-0.5 truncate text-xs text-muted-foreground">{employee.department_name || '-'}</div>
                    </div>
                  </div>
                  <div className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                    {entries.length} {t('Entries')}
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-md bg-muted/40 p-3">
                    <div className="text-xs text-muted-foreground">{t('Department')}</div>
                    <div className="mt-1 truncate font-semibold">{employee.department_name || '-'}</div>
                  </div>
                  <div className="rounded-md bg-muted/40 p-3">
                    <div className="text-xs text-muted-foreground">{t('Actual Salary')}</div>
                    <div className="mt-1 font-semibold">{formatMoney(employee.salary)}</div>
                  </div>
                  <div className="rounded-md bg-muted/40 p-3">
                    <div className="text-xs text-muted-foreground">{t('Advance Taken')}</div>
                    <div className="mt-1 font-semibold text-red-600">{formatMoney(employee.advance_total)}</div>
                  </div>
                  <div className="rounded-md bg-muted/40 p-3">
                    <div className="text-xs text-muted-foreground">{t('Remaining Salary')}</div>
                    <div className={`mt-1 font-semibold ${Number(employee.remaining_salary || 0) < 0 ? 'text-red-600' : 'text-primary'}`}>
                      {formatSignedMoney(employee.remaining_salary)}
                    </div>
                  </div>
                  <div className="rounded-md bg-muted/40 p-3">
                    <div className="text-xs text-muted-foreground">{t('Advance Date')}</div>
                    <div className="mt-1 font-semibold">{formatDate(employee.latest_advance_date)}</div>
                  </div>
                </div>

                <div className="mt-4 grid gap-2">
                  <Button type="button" size="sm" variant="outline" className="w-full justify-center" onClick={() => openCreateForm(employee)}>
                    <Plus className="h-4 w-4" />
                    {t('Add New')}
                  </Button>
                  {Number(employee.advance_total || 0) > 0 && (
                    <Button type="button" size="sm" variant="outline" className="w-full justify-center" onClick={() => openForwardModal(employee)}>
                      <Forward className="h-4 w-4" />
                      {t('Forward Balance')}
                    </Button>
                  )}
                  {entries.length > 0 && (
                    <Button type="button" size="sm" variant="outline" className="w-full justify-center" onClick={() => setMobileEntriesEmployee(employee)}>
                      <ChevronRight className="h-4 w-4" />
                      {t('Show Entries')}
                    </Button>
                  )}
                  {latestAdvance && (
                    <div className="grid grid-cols-2 gap-2">
                      <Button type="button" size="sm" variant="outline" className="justify-center" onClick={() => shareAdvanceOnWhatsApp(employee, latestAdvance)}>
                        <Share2 className="h-4 w-4" />
                        {t('WhatsApp')}
                      </Button>
                      <Button type="button" size="sm" variant="outline" className="justify-center" onClick={() => downloadAdvanceReceiptImage(employee, latestAdvance)}>
                        <Download className="h-4 w-4" />
                        {t('Download')}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <Pagination
          from={advanceEmployees?.from || 0}
          to={advanceEmployees?.to || 0}
          total={advanceEmployees?.total || 0}
          links={advanceEmployees?.links}
          entityName={t('employees with salary advances')}
          onPageChange={(url) => router.get(url)}
        />
      </div>

      {mobileEntriesEmployee && (
        <div className="fixed inset-0 z-[1000] flex items-end bg-black/60 p-0 sm:items-center sm:p-4 lg:hidden">
          <div className="max-h-[88vh] w-full overflow-hidden rounded-t-2xl bg-white shadow-2xl dark:bg-gray-900 sm:mx-auto sm:max-w-lg sm:rounded-lg">
            <div className="flex items-start justify-between gap-3 border-b px-4 py-3">
              <div className="min-w-0">
                <div className="text-xs font-medium uppercase text-muted-foreground">{t('Advance Entries')}</div>
                <div className="truncate text-base font-semibold text-gray-950 dark:text-gray-100">
                  {mobileEntriesEmployee.name}
                </div>
                <div className="text-xs text-muted-foreground">
                  {t('Employee ID')} {mobileEntriesEmployee.employee_code || '-'}
                </div>
                <div className="text-xs text-muted-foreground">
                  {t('Department')} {mobileEntriesEmployee.department_name || '-'}
                </div>
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={() => setMobileEntriesEmployee(null)}>
                {t('Close')}
              </Button>
            </div>
            <div className="max-h-[70vh] space-y-3 overflow-y-auto p-4">
              {(mobileEntriesEmployee.advances || []).map((advance: any) => (
                <div key={advance.id} className="rounded-md border bg-muted/20 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold">{formatMoney(advance.amount)}</div>
                      <div className={advance.is_virtual_repayment ? 'text-xs font-semibold text-blue-600' : 'text-xs text-muted-foreground'}>
                        {advance.status_label || (advance.is_virtual_repayment ? t('Loan repayment') : t('Advance taken'))}
                      </div>
                    </div>
                    <div className="text-right text-xs text-muted-foreground">{formatDate(advance.request_date)}</div>
                  </div>
                  <div className="mt-2 grid gap-1 text-xs text-muted-foreground">
                    <div>{getRepaymentSummary(advance)}</div>
                    <div>
                      {t('Outstanding')}: <span className="font-medium text-gray-900 dark:text-gray-100">{formatMoney(advance.outstanding_amount)}</span>
                    </div>
                    {advance.notes && <div className="break-words">{advance.notes}</div>}
                  </div>
                  {!advance.is_virtual_repayment && (
                    <div className="mt-3 grid grid-cols-4 gap-1">
                      <Button type="button" variant="outline" size="icon" className="h-9 w-full text-green-600" title={t('WhatsApp')} onClick={() => shareAdvanceOnWhatsApp(mobileEntriesEmployee, advance)}>
                        <Share2 className="h-4 w-4" />
                      </Button>
                      <Button type="button" variant="outline" size="icon" className="h-9 w-full text-blue-600" title={t('Download')} onClick={() => downloadAdvanceReceiptImage(mobileEntriesEmployee, advance)}>
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-9 w-full"
                        onClick={() => {
                          setMobileEntriesEmployee(null);
                          openEditForm(advance);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-9 w-full text-red-600"
                        onClick={() => {
                          setMobileEntriesEmployee(null);
                          openDeleteModal({ ...advance, employee_name: mobileEntriesEmployee.name });
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {recentAdvanceContext && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-3xl rounded-lg bg-white shadow-2xl dark:bg-gray-900">
            <div className="flex items-start justify-between gap-4 border-b px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-950 dark:text-gray-100">{t('Advance saved')}</h2>
                <p className="text-sm text-muted-foreground">
                  {recentAdvanceContext.employee.name} · {formatMoney(recentAdvanceContext.advance.amount)} · {formatDate(recentAdvanceContext.advance.request_date)}
                </p>
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={() => setRecentAdvance(null)}>
                {t('Close')}
              </Button>
            </div>
            <div className="space-y-4 p-5">
              <div className="rounded-md border bg-gray-50 p-3 dark:bg-gray-950">
                {recentReceiptUrl ? (
                  <img
                    src={recentReceiptUrl}
                    alt={t('Salary advance receipt')}
                    className="mx-auto w-full max-w-2xl rounded-sm bg-white"
                  />
                ) : (
                  <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
                    {t('Generating image...')}
                  </div>
                )}
              </div>
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button type="button" variant="outline" onClick={() => setRecentAdvance(null)}>
                  {t('Close')}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => downloadAdvanceReceiptImage(recentAdvanceContext.employee, recentAdvanceContext.advance)}
                >
                  <Download className="h-4 w-4" />
                  {t('Download')}
                </Button>
                <Button
                  type="button"
                  className="text-white hover:text-white"
                  onClick={() => shareAdvanceOnWhatsApp(recentAdvanceContext.employee, recentAdvanceContext.advance)}
                >
                  <Share2 className="h-4 w-4" />
                  {t('WhatsApp')}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <Dialog open={Boolean(forwardEmployee)} onOpenChange={(open) => !open && closeForwardModal()}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{t('Forward Advance Balance')}</DialogTitle>
          </DialogHeader>

          {forwardEmployee && (
            <form onSubmit={submitForwardBalance} className="space-y-5">
              <div className="grid gap-3 rounded-md border bg-muted/30 p-3 text-sm sm:grid-cols-3">
                <div>
                  <div className="text-muted-foreground">{t('Employee')}</div>
                  <div className="font-semibold">{forwardEmployee.name}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">{t('Employee ID')}</div>
                  <div className="font-semibold">{forwardEmployee.employee_code || '-'}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">{t('Department')}</div>
                  <div className="font-semibold">{forwardEmployee.department_name || '-'}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">{t('Month')}</div>
                  <div className="font-semibold">{formatMonthLabel(selectedMonth || currentMonth())}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">{t('Actual Salary')}</div>
                  <div className="font-semibold">{formatMoney(forwardEmployee.salary)}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">{t('Current Advance')}</div>
                  <div className="font-semibold text-red-600">{formatMoney(forwardCurrentTotal)}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">{t('Current Remaining')}</div>
                  <div className={`font-semibold ${Number(forwardEmployee.remaining_salary || 0) < 0 ? 'text-red-600' : 'text-primary'}`}>
                    {formatSignedMoney(forwardEmployee.remaining_salary)}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">{t('Next Month')}</div>
                  <div className="font-semibold">{forwardNextMonthLabel}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">{t('Entries')}</div>
                  <div className="font-semibold">{forwardRealEntries.length}</div>
                </div>
              </div>

              {forwardRealEntries.length > 0 && (
                <div className="rounded-md border">
                  <div className="grid grid-cols-[1fr_1fr_1.5fr] gap-3 border-b bg-muted/30 px-3 py-2 text-sm font-medium text-muted-foreground">
                    <div>{t('Advance Amount')}</div>
                    <div>{t('Date')}</div>
                    <div>{t('Notes')}</div>
                  </div>
                  <div className="divide-y">
                    {forwardRealEntries.map((advance: any) => (
                      <div key={advance.id} className="grid grid-cols-[1fr_1fr_1.5fr] gap-3 px-3 py-2 text-sm">
                        <div className="font-semibold">{formatMoney(advance.amount)}</div>
                        <div>{formatDate(advance.request_date)}</div>
                        <div className="truncate text-muted-foreground">{advance.notes || '-'}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="forward-deduct-amount" required>{t('Deduct This Month')}</Label>
                  <Input
                    id="forward-deduct-amount"
                    type="number"
                    min="0"
                    max={forwardCurrentTotal}
                    step="0.01"
                    value={forwardDeductAmount}
                    onChange={(event) => setForwardDeductAmount(event.target.value)}
                    autoFocus
                  />
                  {forwardAmountInvalid && (
                    <div className="text-sm text-red-600">{t('Amount must be between zero and current advance total.')}</div>
                  )}
                </div>
                <div className="rounded-md border bg-primary/5 p-3">
                  <div className="text-sm text-muted-foreground">{t('Forward to Next Month')}</div>
                  <div className="mt-1 text-2xl font-semibold text-primary">{formatMoney(forwardBalanceAmount)}</div>
                  <div className="mt-1 text-sm text-muted-foreground">{forwardNextMonthLabel}</div>
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={closeForwardModal}>
                  {t('Cancel')}
                </Button>
                <Button type="submit" className="text-white hover:text-white" disabled={forwardAmountInvalid || !forwardEmployee}>
                  <Forward className="h-4 w-4" />
                  {t('Update Advance')}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <CrudFormModal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSubmit={submitAdvance}
        initialData={current}
        mode={mode}
        title={mode === 'create' ? t('Add New Advance') : t('Edit Advance')}
        formConfig={{
          modalSize: 'lg',
          layout: 'grid',
          columns: 2,
          fields: [
            { name: 'employee_id', label: t('Employee'), type: 'select', required: true, searchable: true, options: employeeOptions, colSpan: 2 },
            {
              name: 'employee_advance_summary',
              label: t('Employee Details'),
              type: 'custom',
              colSpan: 2,
              conditional: (_mode: any, formData: any) => Boolean(formData.employee_id),
              render: (_field: any, formData: any) => {
                const summary = getEmployeeAdvanceSummary(formData.employee_id);

                if (!summary) {
                  return (
                    <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                      {t('Select an employee to see salary and advance details.')}
                    </div>
                  );
                }

                return (
                  <div className="grid gap-3 rounded-md border bg-muted/30 p-3 text-sm sm:grid-cols-3">
                    <div>
                      <div className="text-muted-foreground">{t('Employee ID')}</div>
                      <div className="font-semibold">{summary.employee_code || '-'}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">{t('Base Salary')}</div>
                      <div className="font-semibold">{formatMoney(summary.salary)}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">{t('Already Taken Advance')}</div>
                      <div className="font-semibold text-red-600">{formatMoney(summary.advance_total)}</div>
                    </div>
                  </div>
                );
              },
            },
            {
              name: 'amount',
              label: t('Advance Amount'),
              type: 'custom',
              required: true,
              render: (field: any, formData: any, handleChange: any) => (
                <Input
                  id={field.name}
                  name={field.name}
                  type="number"
                  value={formData.amount || ''}
                  onChange={(event) => {
                    const value = event.target.value ? Number(event.target.value) : '';
                    handleChange('amount', value);
                    updateInstallmentMonths({ ...formData, amount: value }, handleChange);
                  }}
                />
              ),
            },
            {
              name: 'repayment_type',
              label: t('Repayment Type'),
              type: 'select',
              required: true,
              options: [
                { value: 'full', label: t('Full deduction') },
                { value: 'installment', label: t('Salary in installments') },
              ],
              colSpan: 1,
            },
            {
              name: 'repayment_source',
              label: t('Deduct From'),
              type: 'select',
              required: true,
              options: [
                { value: 'salary', label: t('Salary') },
                { value: 'bonus', label: t('Bonus') },
              ],
              colSpan: 1,
            },
            {
              name: 'installment_months',
              label: t('Installment Months'),
              type: 'number',
              required: true,
              readOnly: true,
              conditional: (_mode: any, formData: any) => formData.repayment_type === 'installment',
            },
            {
              name: 'monthly_installment_amount',
              label: t('Max Deduction Per Month'),
              type: 'custom',
              required: true,
              conditional: (_mode: any, formData: any) => formData.repayment_type === 'installment',
              render: (field: any, formData: any, handleChange: any) => (
                <Input
                  id={field.name}
                  name={field.name}
                  type="number"
                  value={formData.monthly_installment_amount || ''}
                  onChange={(event) => {
                    const value = event.target.value ? Number(event.target.value) : '';
                    handleChange('monthly_installment_amount', value);
                    updateInstallmentMonths({ ...formData, monthly_installment_amount: value }, handleChange);
                  }}
                />
              ),
            },
            {
              name: 'request_date',
              label: t('Advance Date'),
              type: 'date',
              required: true,
              conditional: (_mode: any, formData: any) => formData.repayment_type === 'installment',
              colSpan: 1,
            },
            {
              name: 'advance_amount_warning',
              label: t('Advance Warning'),
              type: 'custom',
              colSpan: 2,
              conditional: (_mode: any, formData: any) => Boolean(getAdvanceWarning(formData)),
              render: (_field: any, formData: any) => {
                const warning = getAdvanceWarning(formData);

                if (!warning) {
                  return null;
                }

                return (
                  <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                    <div className="font-semibold">{warning.title}</div>
                    <div className="mt-1">{warning.detail}</div>
                  </div>
                );
              },
            },
            {
              name: 'request_date',
              label: t('Advance Date'),
              type: 'date',
              required: true,
              conditional: (_mode: any, formData: any) => formData.repayment_type !== 'installment',
            },
            { name: 'notes', label: t('Notes'), type: 'textarea', colSpan: 2 },
          ],
        }}
      />

      <CrudDeleteModal
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        itemName={current?.employee_name || ''}
        entityName={
          deleteMode === 'bulk'
            ? t('selected employees salary advances')
            : t('salary advance')
        }
        onConfirm={confirmDelete}
      />
    </PageTemplate>
  );
}
