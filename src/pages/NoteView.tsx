import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useMsal } from '@azure/msal-react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Eye, Code, ExternalLink, CheckCircle2, Cloud, LogIn, RefreshCw } from 'lucide-react';
import { useFileContent } from '@/graph/hooks';
import { createGraphClient, getDriveItemByPath, searchDriveFiles } from '@/graph/client';
import { useAuth } from '@/auth/useAuth';
import { renderMarkdown, extractFrontmatter } from '@/markdown';
import { resolveStoredWikiTarget } from '@/markdown/linkResolver';
import { db } from '@/offline/db';
import { getCachedContent } from '@/offline/content';
import 'katex/dist/katex.min.css';

export function NoteView() {
  const params = useParams();
  const directId = params.itemId ?? null;
  const wikiTarget = params['*'] ?? null;
  const navigate = useNavigate();
  const location = useLocation();
  const { instance } = useMsal();
  const { isAuthenticated, login } = useAuth();
  const [resolvedId, setResolvedId] = useState<string | null>(null);
  const [resolvedTarget, setResolvedTarget] = useState<string | null>(null);
  const [title, setTitle] = useState('Note');
  const [renderedContent, setRenderedContent] = useState<unknown>(null);
  const [showRaw, setShowRaw] = useState(false);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [loadSource, setLoadSource] = useState<'cache' | 'network' | null>(null);

  const itemId = directId ?? (resolvedTarget === wikiTarget ? resolvedId : null);
  const resolvingWiki = !directId && Boolean(wikiTarget) && resolvedTarget !== wikiTarget;

  const {
    data: content,
    isLoading,
    isRefreshing,
    isOnline,
    error,
    refetch,
  } = useFileContent(itemId || '', !!itemId);

  useEffect(() => {
    if (directId || !wikiTarget) return;
    let cancelled = false;
    const client = createGraphClient(instance);
    const lookup = isAuthenticated
      ? {
          fetchByPath: async (path: string) => {
            try {
              return await getDriveItemByPath(client, path);
            } catch {
              return null;
            }
          },
          searchByName: async (name: string) => {
            try {
              return await searchDriveFiles(client, name);
            } catch {
              return [];
            }
          },
        }
      : undefined;

    resolveStoredWikiTarget(wikiTarget, lookup).then((id) => {
      if (cancelled) return;
      setResolvedId(id);
      setResolvedTarget(wikiTarget);
    });

    return () => {
      cancelled = true;
    };
  }, [directId, wikiTarget, isAuthenticated, instance]);

  useEffect(() => {
    if (!itemId) return;
    let cancelled = false;
    db.files.get(itemId).then((file) => {
      if (cancelled) return;
      setTitle(file?.name.replace(/\.md$/i, '') || 'Note');
    });
    getCachedContent(itemId).then((cached) => {
      if (!cancelled) setLoadSource(cached ? 'cache' : 'network');
    });
    return () => {
      cancelled = true;
    };
  }, [itemId]);

  useEffect(() => {
    if (content) {
      const frontmatter = extractFrontmatter(content);
      setSourceUrl(frontmatter?.source || null);
      renderMarkdown(content).then(result => {
        setRenderedContent(result);
      });
    }
  }, [content]);

  useEffect(() => {
    if (location.hash) {
      const anchorId = location.hash.substring(1);
      setTimeout(() => {
        const element = document.getElementById(anchorId);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth' });
        }
      }, 100);
    }
  }, [location.hash, renderedContent]);

  if (!directId && !wikiTarget) {
    return (
      <div className="p-4">
        <p className="text-destructive">No note specified</p>
      </div>
    );
  }

  if (!itemId) {
    if (resolvingWiki) {
      return (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      );
    }

    return (
      <div className="p-4">
        <div className="flex items-center gap-4 mb-6">
          <Button onClick={() => navigate(-1)} variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-bold">Note not found</h1>
        </div>
        <p className="text-muted-foreground">
          Unable to resolve note: {wikiTarget}
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-background">
      <div className="border-b bg-card">
        <div className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <Button onClick={() => navigate('/browse')} variant="ghost" size="icon">
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <h1 className="text-xl font-semibold truncate">{title}</h1>
            </div>
            <div className="flex items-center gap-1">
              {loadSource && !isLoading && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground px-2">
                  {loadSource === 'cache' ? (
                    <>
                      <CheckCircle2 className="w-3 h-3 text-green-500" />
                      <span>Cached</span>
                    </>
                  ) : (
                    <>
                      <Cloud className="w-3 h-3 text-blue-500" />
                      <span>From OneDrive</span>
                    </>
                  )}
                </div>
              )}
              {sourceUrl && (
                <Button asChild variant="ghost" size="icon">
                  <a href={sourceUrl} target="_blank" rel="noopener noreferrer" title="Open original article">
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              )}
              {isAuthenticated ? (
                <Button
                  onClick={() => refetch()}
                  variant="ghost"
                  size="icon"
                  disabled={!isOnline || isRefreshing}
                  title="Refresh from OneDrive"
                >
                  <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                </Button>
              ) : (
                <Button
                  onClick={login}
                  variant="ghost"
                  size="icon"
                  disabled={!isOnline}
                  title="Sign in to refresh from OneDrive"
                >
                  <LogIn className="h-4 w-4" />
                </Button>
              )}
              <Button onClick={() => setShowRaw(!showRaw)} variant="ghost" size="icon" title={showRaw ? 'Show rendered' : 'Show raw'}>
                {showRaw ? <Eye className="h-4 w-4" /> : <Code className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto p-4">

        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <div className="text-muted-foreground">Loading...</div>
          </div>
        )}

        {(error ?? null) && (
          <div className="p-4 border border-destructive rounded-md">
            <p className="text-destructive">Failed to load note</p>
            <p className="text-sm text-muted-foreground mt-2">
              {error instanceof Error ? error.message : 'Unknown error'}
            </p>
          </div>
        )}

        {showRaw ? (
          <pre className="bg-muted p-4 rounded-md overflow-auto text-sm">
            <code>{content}</code>
          </pre>
        ) : (
          <article className="prose prose-slate dark:prose-invert max-w-none">
            <>{renderedContent}</>
          </article>
        )}
        </div>
      </div>
    </div>
  );
}
