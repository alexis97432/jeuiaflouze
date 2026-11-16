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
