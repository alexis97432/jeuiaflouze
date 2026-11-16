import { describe, expect, it, vi } from 'vitest';
import { createTracker, memorySink, type MetricEvent } from '../../src/platform/metrics';

const setup = () => {
  const sink = memorySink();
  let clock = 1000;
  const tracker = createTracker({
    buildId: 'abc123',
    rulesVersion: 1,
    sessionId: 'sess',
    sink,
    now: () => clock,
  });
  return { sink, tracker, advance: (ms: number) => (clock += ms) };
};

describe('createTracker', () => {
  it('ajoute les champs communs du contrat', () => {
    const { sink, tracker, advance } = setup();
    advance(250);
    tracker.track('run_start', { mode: 'free', runId: 'r1' });
    expect(sink.events).toEqual<MetricEvent[]>([
      {
        name: 'run_start',
        schemaVersion: 1,
        rulesVersion: 1,
        buildId: 'abc123',
        sessionId: 'sess',
        t: 250,
        mode: 'free',
        runId: 'r1',
      },
    ]);
  });

  it('déduplique run_end par runId', () => {
    const { sink, tracker } = setup();
    const end = { mode: 'free' as const, runId: 'r1', score: 3, durationTicks: 10, perfectCount: 0 };
    tracker.track('run_end', end);
    tracker.track('run_end', { ...end, score: 99 });
    tracker.track('run_end', { ...end, runId: 'r2' });
    expect(sink.events.map((e) => [e.name, 'runId' in e ? e.runId : null])).toEqual([
      ['run_end', 'r1'],
      ['run_end', 'r2'],
    ]);
  });

  it('un payload ne peut pas écraser les champs communs', () => {
    const { sink, tracker } = setup();
    tracker.track('run_start', { mode: 'free', runId: 'r', sessionId: 'pirate' } as never);
    expect(sink.events[0]?.sessionId).toBe('sess');
  });

  it("un puits en échec ne casse pas l'appelant", () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const tracker = createTracker({
      buildId: 'b',
      rulesVersion: 1,
      sessionId: 's',
      sink: () => {
        throw new Error('boom');
      },
    });
    expect(() => tracker.track('session_start', {})).not.toThrow();
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });
});

describe('memorySink', () => {
  it('reste borné', () => {
    const sink = memorySink(3);
    const tracker = createTracker({ buildId: 'b', rulesVersion: 1, sessionId: 's', sink });
    for (let i = 0; i < 5; i++) tracker.track('run_start', { mode: 'free', runId: `r${i}` });
    expect(sink.events.map((e) => ('runId' in e ? e.runId : ''))).toEqual(['r2', 'r3', 'r4']);
  });
});
