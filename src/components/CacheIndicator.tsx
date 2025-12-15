import { useEffect, useState } from 'react';
import { CheckCircle2, Cloud, Loader2 } from 'lucide-react';
import { db } from '@/offline/db';
import type { DriveItem } from '@/graph/client';

interface CacheIndicatorProps {
  item: DriveItem;
}

export function CacheIndicator({ item }: CacheIndicatorProps) {
  const [status, setStatus] = useState<'cached' | 'not-cached' | 'checking'>('checking');

  useEffect(() => {
    async function checkCache() {
      const cached = await db.content.get(item.id);
      if (cached && item.eTag && cached.eTag === item.eTag) {
        setStatus('cached');
      } else {
        setStatus('not-cached');
      }
    }
    checkCache();
  }, [item.id, item.eTag]);

  if (status === 'checking') {
    return <Loader2 className="w-3 h-3 text-muted-foreground animate-spin" />;
  }

  if (status === 'cached') {
    return (
      <span title="Cached - will load instantly">
        <CheckCircle2 className="w-3 h-3 text-green-500" />
      </span>
    );
  }

  return (
    <span title="Not cached - will fetch from OneDrive">
      <Cloud className="w-3 h-3 text-blue-500" />
    </span>
  );
}

