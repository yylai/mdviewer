import { isValidElement, type ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { renderMarkdown } from './index';

function textContent(node: ReactNode): string {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textContent).join('');
  if (isValidElement(node)) {
    const props = node.props as { children?: ReactNode };
    return textContent(props.children);
  }
  return '';
}

function elements(node: ReactNode, type: string) {
  const found: Array<{ props: { href?: string; id?: string; children?: ReactNode } }> = [];

  function walk(current: ReactNode) {
    if (current == null || typeof current === 'boolean') return;
    if (typeof current === 'string' || typeof current === 'number') return;
    if (Array.isArray(current)) {
      current.forEach(walk);
      return;
    }
    if (!isValidElement(current)) return;
    if (current.type === type) {
      found.push(current as { props: { href?: string; id?: string; children?: ReactNode } });
    }
    walk((current.props as { children?: ReactNode }).children);
  }

  walk(node);
  return found;
}

describe('markdown pipeline', () => {
  it('shows the alias text for a piped wiki link', async () => {
    const result = await renderMarkdown('[[Note|visible text]]');
    const link = elements(result, 'a')[0];

    expect(textContent(link.props.children)).toBe('visible text');
  });

  it('puts a rehype-slug heading id in the wiki link hash', async () => {
    const result = await renderMarkdown('[[Target#Hello World]]\n\n## Hello World\n');
    const link = elements(result, 'a')[0];
    const heading = elements(result, 'h2')[0];

    expect(heading.props.id).toBe('hello-world');
    expect(link.props.href).toBe('#/note/target#hello-world');
  });

  it('keeps blank lines inside a code block and drops blank lines at the edges', async () => {
    const result = await renderMarkdown('```\n\nalpha\n\nbeta\n\n```\n');
    const code = elements(result, 'code')[0];

    expect(textContent(code.props.children)).toBe('alpha\n\nbeta');
  });
});
