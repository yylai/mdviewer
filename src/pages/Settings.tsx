import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '@/auth/useAuth';

export function Settings() {
  const navigate = useNavigate();
  const { account, logout } = useAuth();

  return (
    <div className="p-4">
      <div className="flex items-center gap-4 mb-6">
        <Button onClick={() => navigate(-1)} variant="ghost" size="icon">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold">Settings</h1>
      </div>
      <div className="space-y-4">
        <div>
          <h2 className="text-sm font-medium text-muted-foreground">Account</h2>
          <p className="text-sm">{account?.username || 'Not signed in'}</p>
        </div>
        <div>
          <Button onClick={logout} variant="destructive">
            Sign Out
          </Button>
        </div>
      </div>
    </div>
  );
}
