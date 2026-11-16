// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RunResult } from '../../src/app/game-contract';
import { mockMountGame } from '../../src/app/mock-game';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] });
  // jsdom n'implémente pas Canvas 2D : le mock doit tolérer un contexte absent.
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const space = (repeat = false) =>
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', repeat, cancelable: true }));

describe('mockMountGame', () => {
  it('termine au placement 1 + seed % 5 et appelle onEnd une fois', () => {
    const onEnd = vi.fn<(r: RunResult) => void>();
    const handle = mockMountGame({
      canvas: document.createElement('canvas'),
      config: { seed: 7, rulesVersion: 1 },
      onEnd,
    });
    vi.advanceTimersByTime(100);
    space();
    space(); // même tick : ignoré
    for (let i = 0; i < 5; i++) {
      vi.advanceTimersByTime(100);
      space();
    }
    expect(onEnd).toHaveBeenCalledOnce();
    const res = onEnd.mock.calls[0]![0];
    expect(res).toMatchObject({ seed: 7, rulesVersion: 1, score: 2 });
    expect(res.inputTicks).toHaveLength(3);
    expect(new Set(res.inputTicks).size).toBe(3);
    handle.destroy();
  });

  it('signale chaque pose réussie, pas le raté', () => {
    const onPlacement = vi.fn();
    const handle = mockMountGame({
      canvas: document.createElement('canvas'),
      config: { seed: 7, rulesVersion: 1 },
      onEnd: () => {},
      onPlacement,
    });
    for (let i = 0; i < 4; i++) {
      vi.advanceTimersByTime(100);
      space();
    }
    expect(onPlacement).toHaveBeenCalledTimes(2); // seed 7 : 2 poses puis raté
    handle.destroy();
  });

  it('ignore Espace répété, la pause et les entrées après destroy', () => {
    const onEnd = vi.fn();
    const handle = mockMountGame({
      canvas: document.createElement('canvas'),
      config: { seed: 1, rulesVersion: 1 },
      onEnd,
    });
    space(true);
    handle.pause();
    space();
    expect(onEnd).not.toHaveBeenCalled();
    handle.destroy();
    handle.resume();
    space();
    expect(onEnd).not.toHaveBeenCalled();
  });

  it("empêche l'action par défaut d'Espace", () => {
    const handle = mockMountGame({
      canvas: document.createElement('canvas'),
      config: { seed: 4, rulesVersion: 1 },
      onEnd: () => {},
    });
    const event = new KeyboardEvent('keydown', { code: 'Space', cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    handle.destroy();
  });
});
