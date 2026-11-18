// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { copyText, shareLink } from '../../src/platform/share';

const data = { title: 'Pile ou Crash', text: 'Défi', url: 'https://jeu.test/?v=3&seed=7&target=4' };

afterEach(() => {
  document.body.innerHTML = '';
});

describe('shareLink', () => {
  it('partage natif : appelé tout de suite avec le lien', async () => {
    const share = vi.fn(async () => {});
    const pending = shareLink(data, { share, canShare: () => true });
    expect(share).toHaveBeenCalledWith(data); // avant toute attente
    expect(await pending).toBe('shared');
  });

  it('annulé : pas de copie silencieuse', async () => {
    const writeText = vi.fn(async () => {});
    const share = async () => { throw new DOMException('non', 'AbortError'); };
    expect(await shareLink(data, { share, clipboard: { writeText } })).toBe('cancelled');
    expect(writeText).not.toHaveBeenCalled();
  });

  it('partage refusé (NotAllowedError) : le lien est copié', async () => {
    const writeText = vi.fn(async () => {});
    const share = async () => { throw new DOMException('geste', 'NotAllowedError'); };
    expect(await shareLink(data, { share, clipboard: { writeText } })).toBe('copied');
    expect(writeText).toHaveBeenCalledWith(data.url);
  });

  it('sans partage natif : copie, sinon indisponible', async () => {
    const writeText = vi.fn(async () => {});
    expect(await shareLink(data, { clipboard: { writeText } })).toBe('copied');
    expect(writeText).toHaveBeenCalledWith(data.url);
    Object.defineProperty(document, 'execCommand', { configurable: true, value: () => false });
    expect(await shareLink(data, {})).toBe('unavailable');
  });
});

describe('copyText', () => {
  it('presse-papiers refusé : repli execCommand sur un champ temporaire retiré ensuite', async () => {
    const copied: string[] = [];
    const execCommand = vi.fn((cmd: string) => {
      const area = document.querySelector('textarea')!;
      copied.push(`${cmd}:${area.value.slice(area.selectionStart, area.selectionEnd)}`);
      return true;
    });
    Object.defineProperty(document, 'execCommand', { configurable: true, value: execCommand });
    const writeText = async () => { throw new DOMException('refus', 'NotAllowedError'); };
    expect(await copyText(data.url, { clipboard: { writeText } }, document)).toBe(true);
    expect(copied).toEqual([`copy:${data.url}`]);
    expect(document.querySelector('textarea')).toBeNull();
  });

  it('aucun moyen de copie : false', async () => {
    Object.defineProperty(document, 'execCommand', { configurable: true, value: () => false });
    expect(await copyText(data.url, {}, document)).toBe(false);
    expect(await copyText(data.url, {}, null)).toBe(false);
  });
});
