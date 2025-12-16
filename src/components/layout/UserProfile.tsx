import { useNavigate } from 'react-router-dom';
import { Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/auth/useAuth';

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
    <div className="border-t border-border p-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
          {account?.idTokenClaims?.picture ? (
            <img
              src={account.idTokenClaims.picture as string}
              alt={displayName}
              className="w-10 h-10 rounded-full"
            />
          ) : (
            <span className="text-primary font-medium text-sm">{initials}</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-foreground truncate">
            {displayName}
          </div>
          <div className="text-xs text-muted-foreground">Free Plan</div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => navigate('/settings')}
          title="Settings"
        >
          <Settings className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

