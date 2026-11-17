import { describe, expect, it, vi } from 'vitest';
import { shareLink } from '../../src/platform/share';

const data = { title: 't', text: 'x', url: 'https://ex.test/?v=1&seed=1&target=2' };
const named = (name: string) => Object.assign(new Error(name), { name });

describe('shareLink', () => {
  it('Web Share réussi', async () => {
    const writeText = vi.fn(async () => {});
    expect(await shareLink(data, { share: async () => {}, clipboard: { writeText } })).toBe('shared');
    expect(writeText).not.toHaveBeenCalled();
  });

  it("annulation : ni succès ni copie silencieuse", async () => {
    const writeText = vi.fn(async () => {});
    const share = async () => {
      throw named('AbortError');
    };
    expect(await shareLink(data, { share, clipboard: { writeText } })).toBe('cancelled');
    expect(writeText).not.toHaveBeenCalled();
  });

  it('partage refusé ou impossible : copie du lien', async () => {
    const writeText = vi.fn(async () => {});
    const share = async () => {
      throw named('NotAllowedError');
    };
    expect(await shareLink(data, { share, clipboard: { writeText } })).toBe('copied');
    expect(writeText).toHaveBeenCalledWith(data.url);
    expect(await shareLink(data, { share: async () => {}, canShare: () => false, clipboard: { writeText } })).toBe('copied');
  });

  it('Web Share absent : copie ; presse-papiers absent ou refusé : unavailable', async () => {
    expect(await shareLink(data, { clipboard: { writeText: async () => {} } })).toBe('copied');
    expect(await shareLink(data, {})).toBe('unavailable');
    expect(
      await shareLink(data, {
        clipboard: {
          writeText: async () => {
            throw named('NotAllowedError');
          },
        },
      }),
    ).toBe('unavailable');
  });
});

describe('partage avec image (V3-A6)', () => {
  const file = new File(['png'], 'pile-ou-crash.png', { type: 'image/png' });
  const data = { title: 't', text: 'x', url: 'https://jeu.test/?s=1', files: [file] };

  it('image jointe si le navigateur sait partager des fichiers', async () => {
    const share = vi.fn(async () => undefined);
    expect(await shareLink(data, { share, canShare: (d) => !!d.files })).toBe('shared');
    expect(share).toHaveBeenCalledWith(data);
  });

  it('sans partage de fichiers : lien seul, sans image', async () => {
    const share = vi.fn(async () => undefined);
    expect(await shareLink(data, { share, canShare: (d) => !d.files })).toBe('shared');
    expect(share).toHaveBeenCalledWith({ title: 't', text: 'x', url: data.url });
  });

  it('annulation avec image : pas un succès, pas de copie silencieuse', async () => {
    const writeText = vi.fn(async () => undefined);
    const share = vi.fn(async () => { throw Object.assign(new Error('x'), { name: 'AbortError' }); });
    expect(await shareLink(data, { share, canShare: () => true, clipboard: { writeText } })).toBe('cancelled');
    expect(writeText).not.toHaveBeenCalled();
  });
});
