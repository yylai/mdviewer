export interface NoteRecord {
  id: string;
  path: string;
  name: string;
  isFolder?: boolean;
}

export interface RemoteNote {
  id: string;
  name: string;
  path: string;
  isFolder?: boolean;
}

export interface WikiLookup {
  fetchByPath: (path: string) => Promise<RemoteNote | null>;
  searchByName: (name: string) => Promise<RemoteNote[]>;
}

export function noteSlug(value: string): string {
  return value
    .replace(/\\/g, '/')
    .replace(/\.md$/i, '')
    .split('/')
    .filter((segment) => segment.length > 0)
    .map((segment) => segment.trim().toLowerCase().replace(/\s+/g, '-'))
    .join('/');
}

export function relativeNotePath(filePath: string, vaultPath: string): string {
  const path = filePath.replace(/\\/g, '/').replace(/^\/+/, '');
  const vault = vaultPath.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
  if (!vault || path === vault) return path === vault ? '' : path;
  const prefix = `${vault}/`;
  return path.startsWith(prefix) ? path.slice(prefix.length) : path;
}

function wikiPage(target: string): string {
  const hashAt = target.indexOf('#');
  return (hashAt === -1 ? target : target.slice(0, hashAt)).trim();
}

export function resolveLocalWikiTarget(
  target: string,
  files: NoteRecord[],
  vaultPath: string,
): string | null {
  const wanted = noteSlug(wikiPage(target));
  if (!wanted) return null;

  const notes = files
    .filter((file) => !file.isFolder && file.name.toLowerCase().endsWith('.md'))
    .map((file) => ({
      id: file.id,
      slug: noteSlug(relativeNotePath(file.path, vaultPath)),
    }))
    .filter((file) => file.slug.length > 0);

  const exact = notes.filter((file) => file.slug === wanted);
  if (exact.length === 1) return exact[0].id;
  if (exact.length > 1) return null;

  if (wanted.includes('/')) return null;

  const byName = notes.filter((file) => file.slug.endsWith(`/${wanted}`));
  return byName.length === 1 ? byName[0].id : null;
}

export async function resolveWikiTarget(
  target: string,
  files: NoteRecord[],
  vaultPath: string,
  lookup?: WikiLookup,
): Promise<string | null> {
  const local = resolveLocalWikiTarget(target, files, vaultPath);
  if (local || !lookup) return local;

  const relative = wikiPage(target).replace(/\.md$/i, '');
  const vault = vaultPath.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
  const fullPath = [vault, `${relative}.md`].filter((part) => part.length > 0).join('/');
  const byPath = await lookup.fetchByPath(fullPath);
  if (byPath && !byPath.isFolder && byPath.name.toLowerCase().endsWith('.md')) {
    return byPath.id;
  }

  const baseName = relative.split('/').filter((part) => part.length > 0).pop() ?? relative;
  const found = await lookup.searchByName(baseName);
  const wanted = noteSlug(relative);
  const hits = found.filter((item) => {
    if (item.isFolder || !item.name.toLowerCase().endsWith('.md')) return false;
    const slug = noteSlug(relativeNotePath(item.path, vaultPath));
    return wanted.includes('/') ? slug === wanted : slug === wanted || slug.endsWith(`/${wanted}`);
  });

  return hits.length === 1 ? hits[0].id : null;
}
