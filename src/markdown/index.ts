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
import rehypeReact from 'rehype-react';
import * as prod from 'react/jsx-runtime';

// Extend sanitize schema to allow KaTeX output
const sanitizeSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    span: [
      ...(defaultSchema.attributes?.span || []),
      ['className', 'katex', 'katex-display', 'katex-html', 'katex-mathml'],
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

export async function renderMarkdown(content: string) {
  const file = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkFrontmatter, ['yaml'])
    .use(remarkMath)
    .use(remarkWikiLink, {
      pageResolver: (name: string) => [name.replace(/ /g, '-').toLowerCase()],
      hrefTemplate: (permalink: string) => `#/note/${permalink}`,
    })
    .use(remarkRehype)
    .use(rehypeSlug)
    .use(rehypeKatex)
    .use(rehypeSanitize, sanitizeSchema)
    .use(rehypeReact, {
      ...prod,
    } as any)
    .process(content);

  return file.result;
}
