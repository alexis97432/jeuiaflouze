/**
 * Partage d'un lien de défi : Web Share si disponible, copie du lien en secours.
 * Un partage annulé n'est pas un succès et ne déclenche pas de copie silencieuse.
 *
 * À appeler directement dans le geste (clic) : aucun `await` avant `navigator.share`, sinon
 * Safari et Chrome Android refusent le partage (activation utilisateur perdue).
 * Le défi part SANS image jointe : avec des fichiers, Android et beaucoup d'applications
 * (messageries) n'envoient que l'image et perdent le lien.
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
      // DOMException n'hérite pas d'Error partout (anciens WebKit, jsdom) : on lit son nom.
      if ((error as { name?: unknown } | null)?.name === 'AbortError') return 'cancelled';
      // NotAllowedError, TypeError… : on bascule sur la copie.
    }
  }
  return (await copyText(data.url, nav)) ? 'copied' : 'unavailable';
}

/**
 * Copie un texte : presse-papiers moderne, puis repli `execCommand('copy')` (navigateurs intégrés
 * aux applications, pages sans permission). false si aucune copie n'a réussi.
 */
export async function copyText(
  text: string,
  nav: ShareNavigator = navigator,
  doc: Document | null = typeof document === 'undefined' ? null : document,
): Promise<boolean> {
  try {
    if (nav.clipboard) {
      await nav.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Refus (permission, document sans focus) : on tente le repli.
  }
  return legacyCopy(text, doc);
}

function legacyCopy(text: string, doc: Document | null): boolean {
  if (!doc?.body || typeof doc.execCommand !== 'function') return false;
  const previous = doc.activeElement as HTMLElement | null;
  const area = doc.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.setAttribute('aria-hidden', 'true');
  // Hors écran sans défilement ; 16 px évite le zoom automatique d'iOS.
  area.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;font-size:16px;';
  doc.body.append(area);
  let ok = false;
  try {
    area.select();
    area.setSelectionRange(0, text.length);
    ok = doc.execCommand('copy');
  } catch {
    ok = false;
  }
  area.remove();
  previous?.focus?.({ preventScroll: true });
  return ok;
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
