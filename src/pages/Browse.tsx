import { Button } from '@/components/ui/button';
import { useAuth } from '@/auth/useAuth';

export function Browse() {
  const { logout } = useAuth();

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Browse</h1>
        <Button onClick={logout} variant="outline">
          Logout
        </Button>
      </div>
      <p className="text-muted-foreground">
        Browse page - Coming soon
      </p>
    </div>
  );
}
