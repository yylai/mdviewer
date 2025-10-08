import { visit } from 'unist-util-visit';

export default function rehypeTrimCode() {
  return (tree: any) => {
    visit(tree, 'element', (node: any) => {
      if (node.tagName === 'code' && node.children.length > 0) {
        const textNode = node.children[0];
        if (textNode.type === 'text') {
          textNode.value = textNode.value
            .split('\n')
            .filter((line: string) => line.trim().length > 0)
            .join('\n');
        }
      }
    });
  };
}
