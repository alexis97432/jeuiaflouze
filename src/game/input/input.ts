/**
 * Entrée unique « poser » : pointeur sur le canvas (tactile, souris, stylet) et
 * barre d'espace.
 *
 * - Uniquement `pointerdown` : aucune écoute de mouse*, touch* ni click, donc un
 *   toucher ne peut pas déclencher deux poses par les événements de compatibilité.
 *   `preventDefault` sur pointerdown supprime en plus ces événements souris émulés.
 * - `touch-action: none` sur le canvas : pas de zoom au double toucher ni de délai.
 * - Espace : keydown sans répétition ni modificateur. `preventDefault` sur keydown
 *   ET keyup en capture, pour qu'un bouton DOM focalisé ne soit pas activé (un
 *   bouton s'active sur le keyup d'espace) et que la page ne défile pas.
 * - `setEnabled(false)` rend la main au DOM (après la fin de partie : les boutons
 *   de résultat redeviennent activables à l'espace).
 */
export interface InputBinding {
  setEnabled(enabled: boolean): void;
  detach(): void;
}

function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement;
}

export function attachInput(
  canvas: HTMLCanvasElement,
  onPress: (timeStamp: number) => void,
): InputBinding {
  const win = canvas.ownerDocument.defaultView ?? window;
  let enabled = true;
  let attached = true;
  const previousTouchAction = canvas.style.touchAction;
  canvas.style.touchAction = 'none';

  const onPointerDown = (e: PointerEvent) => {
    if (!enabled) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    onPress(e.timeStamp);
  };
  const isSpace = (e: KeyboardEvent) => e.code === 'Space' || e.key === ' ';
  const onKeyDown = (e: KeyboardEvent) => {
    if (!enabled || !isSpace(e) || isEditable(e.target)) return;
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.repeat) return;
    onPress(e.timeStamp);
  };
  const onKeyUp = (e: KeyboardEvent) => {
    if (!enabled || !isSpace(e) || isEditable(e.target)) return;
    e.preventDefault();
    e.stopPropagation();
  };

  canvas.addEventListener('pointerdown', onPointerDown);
  win.addEventListener('keydown', onKeyDown, { capture: true });
  win.addEventListener('keyup', onKeyUp, { capture: true });

  return {
    setEnabled(value: boolean) { enabled = value; },
    detach() {
      if (!attached) return;
      attached = false;
      canvas.removeEventListener('pointerdown', onPointerDown);
      win.removeEventListener('keydown', onKeyDown, { capture: true });
      win.removeEventListener('keyup', onKeyUp, { capture: true });
      canvas.style.touchAction = previousTouchAction;
    },
  };
}
