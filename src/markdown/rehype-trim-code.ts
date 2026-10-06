import { visit } from 'unist-util-visit';

interface TextNode {
  type: 'text';
  value: string;
}

interface ElementNode {
  type: 'element';
  tagName?: string;
  children?: Array<{ type: string; value?: string }>;
}

function trimOuterBlankLines(value: string): string {
  const lines = value.split('\n');
  let start = 0;
  let end = lines.length;

  while (start < end && lines[start].trim().length === 0) start += 1;
  while (end > start && lines[end - 1].trim().length === 0) end -= 1;

  return lines.slice(start, end).join('\n');
}

export default function rehypeTrimCode() {
  return (tree: Parameters<typeof visit>[0]) => {
    visit(tree, 'element', (node) => {
      const element = node as ElementNode;
      if (element.tagName !== 'code' || !element.children?.length) return;
      const textNode = element.children[0];
      if (textNode.type !== 'text' || typeof textNode.value !== 'string') return;
      (textNode as TextNode).value = trimOuterBlankLines(textNode.value);
    });
  };
}
