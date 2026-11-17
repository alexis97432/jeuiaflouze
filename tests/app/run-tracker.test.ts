import { describe, expect, it } from 'vitest';
import { createRunTracker, PATTERN_LENGTH } from '../../src/app/run-tracker';

describe('createRunTracker', () => {
  it('meilleure série et motif borné des poses réussies ; le raté est ignoré', () => {
    const t = createRunTracker();
    const streaks = [0, 1, 2, 0, 1, 2, 3, 0];
    streaks.forEach((s, i) => t.onEvent({ type: 'placement', tick: i + 1, floor: i + 1, perfect: s > 0, perfectStreak: s }));
    t.onEvent({ type: 'miss', tick: 99, floor: 9 });
    expect(t.longestStreak).toBe(3);
    expect(t.pattern).toEqual(['placed', 'perfect', 'perfect', 'placed', 'perfect', 'perfect', 'perfect', 'placed']);
    for (let i = 0; i < 30; i++) t.onEvent({ type: 'placement', tick: 100 + i, floor: 10 + i, perfect: false, perfectStreak: 0 });
    expect(t.pattern).toHaveLength(PATTERN_LENGTH);
  });
});
