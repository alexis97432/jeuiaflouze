/**
 * Adaptateur de mesure local (docs/CONTRACTS.md § Mesure).
 * Aucun envoi distant : les puits fournis écrivent en mémoire ou en console.
 * Un futur puits distant exigera configuration explicite et consentement.
 */

export const METRICS_SCHEMA_VERSION = 1;

/** `daily` : proposition additive (revue C3 m1), à confirmer par Codex avant A1.5. */
export type Mode = 'free' | 'challenge' | 'daily';

type RunFields = { mode: Mode; runId: string };

export type EventPayloads = {
  session_start: Record<string, never>;
  /** `day` (YYYY-MM-DD UTC) seulement pour une Tour du jour : date publique, non personnelle. */
  run_start: RunFields & { day?: string };
  first_placement: RunFields;
  run_end: RunFields & { score: number; durationTicks: number; perfectCount: number };
  retry: RunFields & { previousRunId: string };
  share_attempt: RunFields;
  share_success: RunFields;
  challenge_open: { mode: 'challenge' };
};

export type EventName = keyof EventPayloads;

export type MetricEvent<N extends EventName = EventName> = {
  name: N;
  schemaVersion: typeof METRICS_SCHEMA_VERSION;
  rulesVersion: number;
  buildId: string;
  sessionId: string;
  /** Horodatage relatif à la session (ms), pas l'heure murale. */
  t: number;
} & EventPayloads[N];

export type MetricSink = (event: MetricEvent) => void;

export type Tracker = {
  track<N extends EventName>(name: N, payload: EventPayloads[N]): void;
  readonly sessionId: string;
};

export type TrackerOptions = {
  buildId: string;
  rulesVersion: number;
  sessionId: string;
  sink: MetricSink;
  now?: () => number;
};

export function createTracker(options: TrackerOptions): Tracker {
  const now = options.now ?? (() => performance.now());
  const start = now();
  const endedRuns = new Set<string>();

  return {
    sessionId: options.sessionId,
    track(name, payload) {
      if (name === 'run_end') {
        const runId = (payload as EventPayloads['run_end']).runId;
        if (endedRuns.has(runId)) return; // déduplication run_end par runId
        endedRuns.add(runId);
      }
      const event = {
        ...payload,
        name,
        schemaVersion: METRICS_SCHEMA_VERSION,
        rulesVersion: options.rulesVersion,
        buildId: options.buildId,
        sessionId: options.sessionId,
        t: Math.round(now() - start),
      } as MetricEvent;
      try {
        options.sink(event);
      } catch (error) {
        // Une mesure ne doit jamais casser le jeu ; l'erreur reste visible en dev.
        console.warn('[metrics] puits en échec', error);
      }
    },
  };
}

/** Puits mémoire borné, utile en dev et en test. */
export function memorySink(limit = 500): MetricSink & { events: MetricEvent[] } {
  const events: MetricEvent[] = [];
  const sink = ((event: MetricEvent) => {
    events.push(event);
    if (events.length > limit) events.shift();
  }) as MetricSink & { events: MetricEvent[] };
  sink.events = events;
  return sink;
}

export function consoleSink(event: MetricEvent): void {
  console.debug('[metrics]', event.name, event);
}

export function combineSinks(...sinks: MetricSink[]): MetricSink {
  return (event) => {
    for (const sink of sinks) sink(event);
  };
}
