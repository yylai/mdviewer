import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, RefreshCw, Eye, Code } from 'lucide-react';
import { useFileContent } from '@/graph/hooks';
import { renderMarkdown } from '@/markdown';
import { resolveSlugToItemId } from '@/markdown/linkResolver';
import 'katex/dist/katex.min.css';

export function NoteView() {
  const { id: slug } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [itemId, setItemId] = useState<string | null>(null);
  const [renderedContent, setRenderedContent] = useState<unknown>(null);
  const [showRaw, setShowRaw] = useState(false);

  const { data: content, isLoading, error, refetch } = useFileContent(itemId || '', !!itemId);

  useEffect(() => {
    if (slug) {
      resolveSlugToItemId(slug).then(id => {
        if (id) {
          setItemId(id);
        }
      });
    }
  }, [slug]);

  useEffect(() => {
    if (content) {
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

  if (!slug) {
    return (
      <div className="p-4">
        <p className="text-destructive">No note specified</p>
      </div>
    );
  }

  if (!itemId && !isLoading) {
    return (
      <div className="p-4">
        <div className="flex items-center gap-4 mb-6">
          <Button onClick={() => navigate(-1)} variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-bold">Note not found</h1>
        </div>
        <p className="text-muted-foreground">
          Unable to resolve note: {slug}
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto p-4">
        <div className="flex items-center gap-4 mb-6 pb-2 border-b">
          <Button onClick={() => navigate(-1)} variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-xl font-bold flex-1 truncate">{slug}</h1>
          <Button onClick={() => setShowRaw(!showRaw)} variant="ghost" size="icon" title={showRaw ? 'Show rendered' : 'Show raw'}>
            {showRaw ? <Eye className="h-4 w-4" /> : <Code className="h-4 w-4" />}
          </Button>
          <Button onClick={() => refetch()} variant="ghost" size="icon" disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
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
  );
}
