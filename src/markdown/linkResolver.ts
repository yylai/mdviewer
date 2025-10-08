import { db } from '@/offline/db';
import type { VaultFile } from '@/offline/db';

export async function resolveWikiLink(linkName: string): Promise<string | null> {
  const [noteName, anchor] = linkName.split('#');
  const normalizedName = noteName.trim().toLowerCase();

  const allFiles = await db.files.toArray();
  const markdownFiles = allFiles.filter(f => f.name.endsWith('.md'));

  let match: VaultFile | undefined;

  const exactMatch = markdownFiles.find(f => {
    const nameWithoutExt = f.name.replace(/\.md$/, '').toLowerCase();
    return nameWithoutExt === normalizedName;
  });

  if (exactMatch) {
    match = exactMatch;
  } else {
    const aliasMatch = markdownFiles.find(f => 
      f.aliases?.some(alias => alias.toLowerCase() === normalizedName)
    );
    
    if (aliasMatch) {
      match = aliasMatch;
    }
  }

  if (match) {
    const slug = match.name.replace(/\.md$/, '').replace(/ /g, '-').toLowerCase();
    return anchor ? `${slug}#${anchor}` : slug;
  }

  return null;
}

export function createSlugFromFilename(filename: string): string {
  return filename
    .replace(/\.md$/, '')
    .replace(/ /g, '-')
    .toLowerCase();
}

export async function resolveSlugToItemId(slug: string): Promise<string | null> {
  const allFiles = await db.files.toArray();
  const markdownFiles = allFiles.filter(f => f.name.endsWith('.md'));

  const match = markdownFiles.find(f => {
    const fileSlug = createSlugFromFilename(f.name);
    return fileSlug === slug.toLowerCase();
  });

  return match?.driveItemId || null;
}
