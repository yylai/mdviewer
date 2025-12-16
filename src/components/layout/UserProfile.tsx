import { useNavigate } from 'react-router-dom';
import { Settings } from 'lucide-react';
import { useAuth } from '@/auth/useAuth';
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuAction,
} from '@/components/ui/sidebar';

export function UserProfile() {
  const { account } = useAuth();
  const navigate = useNavigate();

  const displayName = account?.name || account?.username || 'User';
  const initials = displayName
    .split(' ')
    .map(n => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

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
              <div className="text-xs text-sidebar-foreground/70">Free Plan</div>
            </div>
          </div>
        </SidebarMenuButton>
        <SidebarMenuAction
          onClick={() => navigate('/settings')}
          title="Settings"
        >
          <Settings className="w-4 h-4" />
        </SidebarMenuAction>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

