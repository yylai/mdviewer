import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkFrontmatter from 'remark-frontmatter';
import remarkMath from 'remark-math';
import remarkWikiLink from 'remark-wiki-link';
import rehypeKatex from 'rehype-katex';
import rehypeSanitize from 'rehype-sanitize';
import rehypeReact from 'rehype-react';
import * as prod from 'react/jsx-runtime';

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
    .use(rehypeKatex)
    .use(rehypeSanitize)
    .use(rehypeReact, {
      ...prod,
    } as any)
    .process(content);

  return file.result;
}
