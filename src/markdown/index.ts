import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkFrontmatter from 'remark-frontmatter';
import remarkMath from 'remark-math';
import remarkWikiLink from 'remark-wiki-link';
import remarkRehype from 'remark-rehype';
import rehypeKatex from 'rehype-katex';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import rehypeSlug from 'rehype-slug';
import rehypeHighlight from 'rehype-highlight';
import rehypeReact from 'rehype-react';
import * as prod from 'react/jsx-runtime';
import yaml from 'js-yaml';
import { slug as headingSlug } from 'github-slugger';
import rehypeTrimCode from './rehype-trim-code';
import { noteSlug } from './noteIdentity';

const sanitizeSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    span: [
      ...(defaultSchema.attributes?.span || []),
      ['className', 'katex', 'katex-display', 'katex-html', 'katex-mathml', /^hljs-/],
    ],
    code: [
      ...(defaultSchema.attributes?.code || []),
      ['className', /^language-/, /^hljs/],
    ],
    pre: [
      ...(defaultSchema.attributes?.pre || []),
      ['className'],
    ],
    math: ['xmlns'],
    semantics: [],
    mrow: [],
    mi: [],
    mo: [],
    mn: [],
    mtext: [],
    annotation: [['encoding']],
  },
  tagNames: [
    ...(defaultSchema.tagNames || []),
    'math',
    'semantics',
    'mrow',
    'mi',
    'mo',
    'mn',
    'mtext',
    'annotation',
  ],
  clobberPrefix: '',
};

function wikiPermalink(name: string): string {
  const hashAt = name.indexOf('#');
  const page = noteSlug(hashAt === -1 ? name : name.slice(0, hashAt));
  if (hashAt === -1) return page;
  return `${page}#${headingSlug(name.slice(hashAt + 1))}`;
}

function wikiHref(permalink: string): string {
  const hashAt = permalink.indexOf('#');
  const page = hashAt === -1 ? permalink : permalink.slice(0, hashAt);
  const encoded = page.split('/').map((segment) => encodeURIComponent(segment)).join('/');
  if (hashAt === -1) return `#/w/${encoded}`;
  return `#/w/${encoded}#${permalink.slice(hashAt + 1)}`;
}

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

const wikiLinkOptions = {
  aliasDivider: '|',
  pageResolver: (name: string) => [wikiPermalink(name)],
  hrefTemplate: (permalink: string) => wikiHref(permalink),
};

export async function renderMarkdown(content: string) {
  const file = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkFrontmatter, ['yaml'])
    .use(remarkMath)
    .use(remarkWikiLink, wikiLinkOptions)
    .use(remarkRehype)
    .use(rehypeSlug)
    .use(rehypeKatex)
    .use(rehypeTrimCode)
    .use(rehypeHighlight)
    .use(rehypeSanitize, sanitizeSchema)
    .use(rehypeReact, {
      ...prod,
    } as never)
    .process(content);

  return file.result;
}
