/**
 * Partage d'un lien de défi : Web Share si disponible, copie du lien en secours.
 * Un partage annulé n'est pas un succès et ne déclenche pas de copie silencieuse.
 */

export type ShareOutcome = 'shared' | 'copied' | 'cancelled' | 'unavailable';

export type ShareData = { title: string; text: string; url: string; files?: File[] };

type ShareNavigator = {
  share?: (data: ShareData) => Promise<void>;
  canShare?: (data: ShareData) => boolean;
  clipboard?: { writeText(text: string): Promise<void> };
};

export async function shareLink(data: ShareData, nav: ShareNavigator = navigator): Promise<ShareOutcome> {
  // Image jointe seulement si le navigateur sait partager des fichiers ; sinon lien seul.
  if (data.files?.length && !(typeof nav.share === 'function' && nav.canShare?.(data) === true)) {
    const { files: _files, ...linkOnly } = data;
    data = linkOnly;
  }
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

/** Enregistre un fichier (image de résultat) par un lien de téléchargement ; false si impossible. */
export function downloadFile(file: File, doc: Document = document): boolean {
  try {
    const url = URL.createObjectURL(file);
    const a = doc.createElement('a');
    a.href = url;
    a.download = file.name;
    a.rel = 'noopener';
    doc.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    return true;
  } catch {
    return false;
  }
}
