import { SidebarTrigger } from '@/components/ui/sidebar';
import { useLayout } from '@/contexts/LayoutContext';
import { type BreadcrumbItem as BreadcrumbItemType } from '@/types';
import { ProfileMenu } from '@/components/profile-menu';
import { usePage, router } from '@inertiajs/react';
import { useTranslation } from 'react-i18next';
import { Maximize } from 'lucide-react';

export function AppSidebarHeader({ breadcrumbs: _breadcrumbs = [] }: { breadcrumbs?: BreadcrumbItemType[] }) {
    const { t } = useTranslation();
    const { position } = useLayout();
    const { isImpersonating } = usePage().props as any;

    return (
        <>
            <header className="flex h-20 shrink-0 items-center gap-2 px-5 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-14 md:px-6">
            <div className="flex w-full items-center justify-between">
                <div className="flex items-center gap-2">
                    {position === 'left' && <SidebarTrigger className="-ml-1" />}
                </div>
                <div className="flex items-center gap-2">
                    {isImpersonating && (
                        <button 
                            onClick={() => router.post(route('impersonate.leave'))}
                            className="bg-red-500 text-white px-2 py-1 rounded text-xs hover:bg-red-600 cursor-pointer"
                        >
                            {t("Return Back")}
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={() => document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.()}
                        className="inline-flex size-9 items-center justify-center rounded-md text-[var(--app-text-soft)] hover:bg-white hover:text-[var(--brand-600)] hover:shadow-sm"
                    >
                        <Maximize className="h-5 w-5" />
                    </button>
                    <ProfileMenu />
                    {position === 'right' && <SidebarTrigger className="-mr-1" />}
                </div>
            </div>
        </header>
        </>
    );
}
