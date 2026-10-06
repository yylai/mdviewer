import yaml from 'js-yaml';

function allowedSource(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  try {
    const url = new URL(value);
    if (url.protocol === 'http:' || url.protocol === 'https:') return value;
  } catch {
    return undefined;
  }
  return undefined;
}

export function extractFrontmatter(content: string): { source?: string } | null {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;
  try {
    const parsed = yaml.load(match[1]);
    if (!parsed || typeof parsed !== 'object') return null;
    const source = allowedSource((parsed as { source?: unknown }).source);
    return source ? { source } : {};
  } catch {
    return null;
  }
}
