import { useState } from 'react';
import { Button } from '@/components/ui/button';

const DISMISS_KEY = 'mdviewer-install-hint-dismissed';

function isIosSafariInstallHint(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  if (window.localStorage.getItem(DISMISS_KEY) === '1') return false;

  const ua = navigator.userAgent;
  const iOS = /iPad|iPhone|iPod/.test(ua)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const safari = /Safari/i.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|Chrome/i.test(ua);
  const nav = navigator as Navigator & { standalone?: boolean };
  const standalone = window.matchMedia('(display-mode: standalone)').matches || nav.standalone === true;
  return iOS && safari && !standalone;
}

export function InstallHint() {
  const [visible, setVisible] = useState(isIosSafariInstallHint);

  if (!visible) return null;

  return (
    <div className="pointer-events-none fixed inset-x-3 bottom-3 z-40 pb-[env(safe-area-inset-bottom)]">
      <div className="pointer-events-auto mx-auto flex max-w-md items-start gap-3 rounded-lg border border-border bg-card px-3 py-2 text-sm shadow-lg">
        <p className="text-foreground">
          Add to Home Screen from the Share menu. iOS can delete offline notes after 7 days unless the app is installed.
        </p>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            window.localStorage.setItem(DISMISS_KEY, '1');
            setVisible(false);
          }}
        >
          Dismiss
        </Button>
      </div>
    </div>
  );
}
