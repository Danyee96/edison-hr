import { useMemo, useRef, useState } from 'react';
import { PageTemplate } from '@/components/page-template';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/custom-toast';
import { router, usePage } from '@inertiajs/react';
import { ChevronDown, ChevronRight, Clock, Database, Download, Pencil, RotateCcw, Trash2, Upload } from 'lucide-react';
import { useTranslation } from 'react-i18next';

type Backup = {
  id: string;
  name: string;
  created_at: string;
  uploaded_at?: string | null;
  source?: 'manual' | 'auto' | 'uploaded' | string;
  size: number;
  tables: number;
  rows: number;
};

type BackupGroup = {
  key: string;
  label: string;
  backups: Backup[];
  size: number;
  rows: number;
};

type BackupTab = 'auto' | 'manual';

export default function SystemBackups() {
  const { t } = useTranslation();
  const { backups = [] } = usePage().props as { backups: Backup[] };
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const [renameBackup, setRenameBackup] = useState<Backup | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [expandedDays, setExpandedDays] = useState<Record<string, boolean>>({});
  const [activeTab, setActiveTab] = useState<BackupTab>('auto');

  const formatDate = (value?: string | null) => {
    if (!value) return '-';

    return window.appSettings?.formatDateTime?.(value) || new Date(value).toLocaleString();
  };

  const formatSize = (bytes: number) => {
    if (!bytes) return '0 KB';
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unit = 0;

    while (size >= 1024 && unit < units.length - 1) {
      size /= 1024;
      unit++;
    }

    return `${size.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
  };

  const dayKey = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value.slice(0, 10);

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  };

  const formatDay = (key: string) => {
    const today = dayKey(new Date().toISOString());
    const yesterdayDate = new Date();
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterday = dayKey(yesterdayDate.toISOString());

    if (key === today) return t('Today');
    if (key === yesterday) return t('Yesterday');

    return new Date(`${key}T00:00:00`).toLocaleDateString(undefined, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const autoBackups = useMemo(() => backups.filter((backup) => backup.source === 'auto'), [backups]);
  const manualBackups = useMemo(() => backups.filter((backup) => backup.source !== 'auto'), [backups]);
  const activeBackups = activeTab === 'auto' ? autoBackups : manualBackups;

  const groupedBackups = useMemo<BackupGroup[]>(() => {
    const groups = new Map<string, Backup[]>();

    activeBackups.forEach((backup) => {
      const key = dayKey(backup.created_at);
      groups.set(key, [...(groups.get(key) || []), backup]);
    });

    return Array.from(groups.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([key, dayBackups]) => ({
        key,
        label: formatDay(key),
        backups: [...dayBackups].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
        size: dayBackups.reduce((total, backup) => total + Number(backup.size || 0), 0),
        rows: dayBackups.reduce((total, backup) => total + Number(backup.rows || 0), 0),
      }));
  }, [activeBackups, t]);

  const isDayExpanded = (group: BackupGroup, index: number) => expandedDays[group.key] ?? index === 0;

  const toggleDay = (key: string, fallback: boolean) => {
    setExpandedDays((current) => ({ ...current, [key]: !(current[key] ?? fallback) }));
  };

  const backupSourceLabel = (backup: Backup) => {
    if (backup.uploaded_at || backup.source === 'uploaded') return t('Uploaded');
    if (backup.source === 'auto') return t('Auto');

    return t('Manual');
  };

  const backupSourceClass = (backup: Backup) => {
    if (backup.uploaded_at || backup.source === 'uploaded') return 'border-purple-200 bg-purple-50 text-purple-700';
    if (backup.source === 'auto') return 'border-emerald-200 bg-emerald-50 text-emerald-700';

    return 'border-blue-200 bg-blue-50 text-blue-700';
  };

  const createBackup = () => {
    const name = window.prompt(t('Backup name'), `System Backup ${new Date().toLocaleString()}`);
    if (name === null) return;

    toast.loading(t('Creating backup...'));
    router.post(route('system-backups.store'), { name }, {
      preserveScroll: true,
      onSuccess: (page: any) => {
        toast.dismiss();
        if (page.props.flash?.success) toast.success(t(page.props.flash.success));
        if (page.props.flash?.error) toast.error(t(page.props.flash.error));
      },
      onError: (errors: any) => {
        toast.dismiss();
        toast.error(typeof errors === 'string' ? errors : Object.values(errors).join(', '));
      },
    });
  };

  const uploadBackup = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    toast.loading(t('Uploading backup...'));
    router.post(route('system-backups.upload'), formData, {
      forceFormData: true,
      preserveScroll: true,
      onSuccess: (page: any) => {
        toast.dismiss();
        if (page.props.flash?.success) toast.success(t(page.props.flash.success));
        if (page.props.flash?.error) toast.error(t(page.props.flash.error));
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

  const submitRename = () => {
    if (!renameBackup) return;

    router.put(route('system-backups.rename', renameBackup.id), { name: renameValue }, {
      preserveScroll: true,
      onSuccess: (page: any) => {
        setRenameBackup(null);
        if (page.props.flash?.success) toast.success(t(page.props.flash.success));
        if (page.props.flash?.error) toast.error(t(page.props.flash.error));
      },
    });
  };

  const restoreBackup = (backup: Backup) => {
    const confirmed = window.confirm(t('Restore this backup? Current system data will be replaced by this backup.'));
    if (!confirmed) return;

    toast.loading(t('Restoring backup...'));
    router.post(route('system-backups.restore', backup.id), {}, {
      preserveScroll: true,
      onSuccess: (page: any) => {
        toast.dismiss();
        if (page.props.flash?.success) toast.success(t(page.props.flash.success));
        if (page.props.flash?.error) toast.error(t(page.props.flash.error));
      },
      onError: (errors: any) => {
        toast.dismiss();
        toast.error(typeof errors === 'string' ? errors : Object.values(errors).join(', '));
      },
    });
  };

  const deleteBackup = (backup: Backup) => {
    const confirmed = window.confirm(t('Delete this backup?'));
    if (!confirmed) return;

    router.delete(route('system-backups.destroy', backup.id), {
      preserveScroll: true,
      onSuccess: (page: any) => {
        if (page.props.flash?.success) toast.success(t(page.props.flash.success));
        if (page.props.flash?.error) toast.error(t(page.props.flash.error));
      },
    });
  };

  const openRename = (backup: Backup) => {
    setRenameBackup(backup);
    setRenameValue(backup.name);
  };

  return (
    <PageTemplate
      title={t('Backup & Restore')}
      url="/system-backups"
      breadcrumbs={[{ title: t('Dashboard'), href: route('dashboard') }, { title: t('Backup & Restore') }]}
      actions={[
        { label: t('Upload Backup'), icon: <Upload className="h-4 w-4" />, onClick: () => uploadInputRef.current?.click() },
        { label: t('Create Backup'), icon: <Database className="h-4 w-4" />, onClick: createBackup },
      ]}
      noPadding
    >
      <input ref={uploadInputRef} type="file" accept=".json,application/json,text/plain" className="hidden" onChange={uploadBackup} />

      <div className="rounded-lg border bg-white shadow-sm dark:bg-gray-900">
        <div className="border-b px-5 py-4">
          <h2 className="text-lg font-semibold text-gray-950 dark:text-gray-100">{t('System Backups')}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('Automatic backups run every 12 hours. Create, download, upload, rename, and restore full database backups.')}
          </p>
        </div>

        <div className="space-y-3 p-4">
          <div className="grid rounded-lg bg-slate-100 p-1 sm:w-fit sm:grid-cols-2 dark:bg-gray-800">
            <button
              type="button"
              className={`rounded-md px-5 py-2.5 text-sm font-semibold transition ${
                activeTab === 'auto'
                  ? 'bg-white text-blue-600 shadow-sm dark:bg-gray-950'
                  : 'text-slate-600 hover:text-blue-600 dark:text-slate-300'
              }`}
              onClick={() => setActiveTab('auto')}
            >
              {t('Auto Backups')} ({autoBackups.length})
            </button>
            <button
              type="button"
              className={`rounded-md px-5 py-2.5 text-sm font-semibold transition ${
                activeTab === 'manual'
                  ? 'bg-white text-blue-600 shadow-sm dark:bg-gray-950'
                  : 'text-slate-600 hover:text-blue-600 dark:text-slate-300'
              }`}
              onClick={() => setActiveTab('manual')}
            >
              {t('Manual Backups')} ({manualBackups.length})
            </button>
          </div>

          {groupedBackups.length === 0 && (
            <div className="rounded-lg border border-dashed px-5 py-12 text-center text-muted-foreground">
              {activeTab === 'auto' ? t('No auto backups found') : t('No manual backups found')}
            </div>
          )}

          {groupedBackups.map((group, index) => {
            const expanded = isDayExpanded(group, index);

            return (
              <div key={group.key} className="overflow-hidden rounded-lg border bg-white shadow-sm dark:bg-gray-900">
                <button
                  type="button"
                  className="flex w-full flex-col gap-3 bg-slate-50 px-5 py-4 text-left transition hover:bg-blue-50 dark:bg-gray-800 dark:hover:bg-gray-700 sm:flex-row sm:items-center sm:justify-between"
                  onClick={() => toggleDay(group.key, index === 0)}
                >
                  <span className="flex items-center gap-3">
                    {expanded ? <ChevronDown className="h-5 w-5 text-blue-600" /> : <ChevronRight className="h-5 w-5 text-slate-500" />}
                    <span>
                      <span className="block text-base font-semibold text-gray-950 dark:text-gray-100">{group.label}</span>
                      <span className="mt-1 block text-sm text-muted-foreground">{group.backups.length} {group.backups.length === 1 ? t('backup') : t('backups')}</span>
                    </span>
                  </span>
                  <span className="flex flex-wrap gap-2 text-sm text-slate-600 dark:text-slate-300">
                    <span className="rounded-full border bg-white px-3 py-1 dark:bg-gray-900">{Number(group.rows || 0).toLocaleString()} {t('rows')}</span>
                    <span className="rounded-full border bg-white px-3 py-1 dark:bg-gray-900">{formatSize(group.size)}</span>
                  </span>
                </button>

                {expanded && (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[900px] text-sm">
                      <thead className="bg-white text-left text-slate-600 dark:bg-gray-900 dark:text-gray-300">
                        <tr>
                          <th className="px-5 py-3 font-semibold">{t('Backup')}</th>
                          <th className="px-5 py-3 font-semibold">{t('Time')}</th>
                          <th className="px-5 py-3 font-semibold">{t('Tables')}</th>
                          <th className="px-5 py-3 font-semibold">{t('Rows')}</th>
                          <th className="px-5 py-3 font-semibold">{t('Size')}</th>
                          <th className="px-5 py-3 text-right font-semibold">{t('Actions')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.backups.map((backup) => (
                          <tr key={backup.id} className="border-t">
                            <td className="px-5 py-4">
                              <div className="flex flex-wrap items-center gap-2">
                                <div className="font-semibold text-gray-950 dark:text-gray-100">{backup.name}</div>
                                <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${backupSourceClass(backup)}`}>
                                  {backupSourceLabel(backup)}
                                </span>
                              </div>
                              {backup.uploaded_at && (
                                <div className="mt-1 text-xs text-muted-foreground">{t('Uploaded')} {formatDate(backup.uploaded_at)}</div>
                              )}
                            </td>
                            <td className="px-5 py-4">
                              <span className="inline-flex items-center gap-2">
                                <Clock className="h-4 w-4 text-slate-400" />
                                {formatDate(backup.created_at)}
                              </span>
                            </td>
                            <td className="px-5 py-4">{backup.tables}</td>
                            <td className="px-5 py-4">{Number(backup.rows || 0).toLocaleString()}</td>
                            <td className="px-5 py-4">{formatSize(backup.size)}</td>
                            <td className="px-5 py-4">
                              <div className="flex flex-wrap justify-end gap-2">
                                <Button type="button" variant="outline" size="sm" onClick={() => window.location.href = route('system-backups.download', backup.id)}>
                                  <Download className="h-4 w-4" />
                                  {t('Download')}
                                </Button>
                                <Button type="button" variant="outline" size="sm" onClick={() => openRename(backup)}>
                                  <Pencil className="h-4 w-4" />
                                  {t('Rename')}
                                </Button>
                                <Button type="button" variant="outline" size="sm" onClick={() => restoreBackup(backup)}>
                                  <RotateCcw className="h-4 w-4" />
                                  {t('Restore')}
                                </Button>
                                <Button type="button" variant="outline" size="sm" className="text-red-600" onClick={() => deleteBackup(backup)}>
                                  <Trash2 className="h-4 w-4" />
                                  {t('Delete')}
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <Dialog open={Boolean(renameBackup)} onOpenChange={(open) => !open && setRenameBackup(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('Rename Backup')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="backup-name">{t('Name')}</Label>
            <Input id="backup-name" value={renameValue} onChange={(event) => setRenameValue(event.target.value)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRenameBackup(null)}>
              {t('Cancel')}
            </Button>
            <Button type="button" className="text-white hover:text-white" onClick={submitRename}>
              {t('Save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageTemplate>
  );
}
