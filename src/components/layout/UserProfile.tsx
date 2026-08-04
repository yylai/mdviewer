import { useNavigate } from 'react-router-dom';
import { Settings } from 'lucide-react';
import { useAuth } from '@/auth/useAuth';
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuAction,
  useSidebar,
} from '@/components/ui/sidebar';

export function UserProfile() {
  const { account, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const { isMobile, setOpenMobile } = useSidebar();

  const displayName = account?.name || account?.username || 'Offline library';
  const initials = displayName
    .split(' ')
    .map(n => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const handleSettingsClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
    navigate('/settings');
  };

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          size="lg"
          className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
        >
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
              {account?.idTokenClaims?.picture ? (
                <img
                  src={account.idTokenClaims.picture as string}
                  alt={displayName}
                  className="w-8 h-8 rounded-full"
                />
              ) : (
                <span className="text-primary font-medium text-xs">{initials}</span>
              )}
            </div>
            <div className="flex-1 min-w-0 text-left">
              <div className="text-sm font-medium text-sidebar-foreground truncate">
                {displayName}
              </div>
              {!isAuthenticated && (
                <div className="text-xs text-sidebar-foreground/70 truncate">
                  Local files only
                </div>
              )}
            </div>
          </div>
        </SidebarMenuButton>
        <SidebarMenuAction
          onClick={handleSettingsClick}
          title="Settings"
        >
          <Settings className="w-4 h-4" />
        </SidebarMenuAction>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

