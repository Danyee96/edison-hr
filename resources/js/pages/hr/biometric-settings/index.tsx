import { PageTemplate } from '@/components/page-template';
import { router, usePage } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { hasPermission } from '@/utils/authorization';
import { useTranslation } from 'react-i18next';
import ZektoSettings from '@/pages/settings/components/zekto-settings';

export default function BiometricSettings() {
  const { t } = useTranslation();
  const { zektoSettings = {}, auth } = usePage().props as any;

  return (
    <PageTemplate title={t('Biometric Settings')} url="/hr/biometric-settings"
      breadcrumbs={[{ title: t('Dashboard'), href: route('dashboard') }, { title: t('Biometric Settings') }]}>
      <div className="space-y-6">
        {hasPermission(auth?.permissions || [], 'manage-biometric-attendance') && (
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => router.get(route('hr.biometric-attendance.index'))}>
              {t('View biometric attendance and import records')}
            </Button>
          </div>
        )}
        <ZektoSettings settings={zektoSettings} />
      </div>
    </PageTemplate>
  );
}
