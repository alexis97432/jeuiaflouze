/** Petits constructeurs DOM sans innerHTML (aucune donnée n'est interprétée comme du HTML). */

export function el<K extends keyof HTMLElementTagNameMap>(
  doc: Document,
  tag: K,
  props: Partial<Record<string, string>> = {},
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = doc.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value !== undefined) node.setAttribute(key, value);
  }
  if (text !== undefined) node.textContent = text;
  return node;
}

export function button(
  doc: Document,
  label: string,
  onClick: () => void,
  variant: 'primary' | 'secondary' | 'ghost' = 'secondary',
  testId?: string,
): HTMLButtonElement {
  const b = el(doc, 'button', { type: 'button', class: `btn ${variant}`, 'data-testid': testId }, label);
  b.addEventListener('click', onClick);
  return b;
}

export const floors = (n: number) => `${n} étage${n > 1 ? 's' : ''}`;
