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
import rehypeTrimCode from './rehype-trim-code';

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
};

export function extractFrontmatter(content: string): { source?: string } | null {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;
  try {
    return yaml.load(match[1]) as { source?: string };
  } catch {
    return null;
  }
}

export async function renderMarkdown(content: string) {
  const file = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkFrontmatter, ['yaml'])
    .use(remarkMath)
    .use(remarkWikiLink, {
      pageResolver: (name: string) => {
        const slug = name
          .split('#')[0]
          .replace(/ /g, '-')
          .toLowerCase();
        return [slug];
      },
      hrefTemplate: (permalink: string) => {
        const fullLink = permalink;
        if (fullLink.includes('#')) {
          const [slug, anchor] = fullLink.split('#');
          return `#/note/${slug}#${anchor}`;
        }
        return `#/note/${permalink}`;
      },
    })
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
