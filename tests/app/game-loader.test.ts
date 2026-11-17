import { describe, expect, it, vi } from 'vitest';
import type { GameEvent, GameHandle, MountOptions } from '../../src/app/game-contract';
import { createStartGame } from '../../src/app/game-loader';

function fakeMount() {
  const calls: MountOptions[] = [];
  const handle: GameHandle = { pause: vi.fn(), resume: vi.fn(), destroy: vi.fn() };
  const mount = (options: MountOptions) => {
    calls.push(options);
    return handle;
  };
  return { calls, handle, mount };
}

const canvas = {} as HTMLCanvasElement;
const config = { seed: 9, rulesVersion: 1 } as const;
const placement = (tick: number): GameEvent => ({ type: 'placement', tick, floor: 1, perfect: false, perfectStreak: 0 });

describe('createStartGame', () => {
  it('transmet canvas, config et onEnd, et traduit muted en sound', () => {
    const { calls, handle, mount } = fakeMount();
    const onEnd = vi.fn();
    const start = createStartGame(mount);
    expect(start({ canvas, config, onEnd, prefs: { muted: true } })).toBe(handle);
    expect(start({ canvas, config, onEnd, prefs: { muted: false } })).toBe(handle);
    expect(calls[0]).toMatchObject({ canvas, config, onEnd, sound: false });
    expect(calls[1]?.sound).toBe(true);
    expect(calls[0]).not.toHaveProperty('reducedMotion'); // préférence système suivie par le moteur
    expect(calls[0]).not.toHaveProperty('prefs');
  });

  it('dérive first_placement de la première pose réussie seulement', () => {
    const { calls, mount } = fakeMount();
    const onFirstPlacement = vi.fn();
    createStartGame(mount)({ canvas, config, onEnd: vi.fn(), prefs: { muted: false }, onFirstPlacement });
    const onEvent = calls[0]!.onEvent!;
    onEvent({ type: 'miss', tick: 3, floor: 1 });
    expect(onFirstPlacement).not.toHaveBeenCalled();
    onEvent(placement(5));
    onEvent(placement(9));
    expect(onFirstPlacement).toHaveBeenCalledOnce();
  });

  it('chaque partie a son propre compteur', () => {
    const { calls, mount } = fakeMount();
    const onFirstPlacement = vi.fn();
    const start = createStartGame(mount);
    for (let i = 0; i < 2; i++) start({ canvas, config, onEnd: vi.fn(), prefs: { muted: false }, onFirstPlacement });
    calls[0]!.onEvent!(placement(1));
    calls[1]!.onEvent!(placement(1));
    expect(onFirstPlacement).toHaveBeenCalledTimes(2);
  });
});

describe('apparence (A4)', () => {
  it("transmet l'apparence choisie au montage, et rien quand elle est absente", () => {
    const { calls, mount } = fakeMount();
    const start = createStartGame(mount);
    start({ canvas, config, onEnd: vi.fn(), prefs: { muted: false }, appearance: { theme: 'orbital', skin: 'marbre' } });
    start({ canvas, config, onEnd: vi.fn(), prefs: { muted: false } });
    expect(calls[0]?.appearance).toEqual({ theme: 'orbital', skin: 'marbre' });
    expect(calls[1]).not.toHaveProperty('appearance');
  });
});
