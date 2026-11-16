/**
 * Partage d'un lien de défi : Web Share si disponible, copie du lien en secours.
 * Un partage annulé n'est pas un succès et ne déclenche pas de copie silencieuse.
 */

export type ShareOutcome = 'shared' | 'copied' | 'cancelled' | 'unavailable';

export type ShareData = { title: string; text: string; url: string };

type ShareNavigator = {
  share?: (data: ShareData) => Promise<void>;
  canShare?: (data: ShareData) => boolean;
  clipboard?: { writeText(text: string): Promise<void> };
};

export async function shareLink(data: ShareData, nav: ShareNavigator = navigator): Promise<ShareOutcome> {
  if (typeof nav.share === 'function' && (nav.canShare?.(data) ?? true)) {
    try {
      await nav.share(data);
      return 'shared';
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return 'cancelled';
      // NotAllowedError, TypeError… : on bascule sur la copie.
    }
  }
  return (await copyText(data.url, nav)) ? 'copied' : 'unavailable';
}

export async function copyText(text: string, nav: ShareNavigator = navigator): Promise<boolean> {
  try {
    if (!nav.clipboard) return false;
    await nav.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
