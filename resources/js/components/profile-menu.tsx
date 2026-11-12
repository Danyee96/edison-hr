import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Link, router, usePage } from '@inertiajs/react';
import { LogOut, Settings, User } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export function ProfileMenu() {
  const { t } = useTranslation();
  const { auth } = usePage().props as any;
  const user = auth?.user;
  // Get avatar URL
  const getAvatarUrl = () => {
    // Show uploaded avatar from database
    if (auth?.user?.avatar) {
      return window.storage(auth.user.avatar);
    }
    // Show default avatar
    return window.asset('images/avatar/avatar.png');
  };

  const handleLogout = () => {
    router.post(route('logout'));
  };

  const initials = user?.name
    ? user.name
      .split(' ')
      .map((n: string) => n[0])
      .join('')
      .toUpperCase()
    : 'U';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="flex h-12 items-center gap-3 rounded-md px-2 hover:bg-white hover:shadow-sm">
          <span className="hidden text-right leading-tight md:inline-block">
            <span className="block text-sm font-bold text-[#718198]">{user?.name}</span>
            <span className="block text-xs font-semibold text-[#9aa8b8]">{t('Available')}</span>
          </span>
          <Avatar className="h-11 w-11 border-2 border-white shadow-lg">
            <AvatarImage src={getAvatarUrl()} />
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{user?.name}</p>
            <p className="text-xs leading-none text-muted-foreground">
              {user?.email}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem asChild>
            <Link href={route('profile')}>
              <User className="mr-2 h-4 w-4" />
              <span>{t("Profile")}</span>
            </Link>
          </DropdownMenuItem>

        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout}>
          <LogOut className="mr-2 h-4 w-4" />
          <span>{t("Log out")}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
