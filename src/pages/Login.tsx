import { Button } from '@/components/ui/button';
import { useAuth } from '@/auth/useAuth';

export function Login() {
  const { login } = useAuth();

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <div className="max-w-md w-full space-y-6 text-center">
        <h1 className="text-3xl font-bold">OneDrive Markdown Viewer</h1>
        <p className="text-muted-foreground">
          Browse and read your Obsidian notes stored in OneDrive
        </p>
        <Button onClick={login} size="lg" className="w-full">
          Sign in with Microsoft
        </Button>
      </div>
    </div>
  );
}
