/**
 * Journal de diagnostic local (V7), exportable par le joueur depuis Réglages.
 *
 * But : faciliter le prochain signalement d'un « crash » sur téléphone, en distinguant :
 * - une exception JavaScript (`erreur`, `rejet`) ;
 * - une couche du rendu coupée après une erreur (`effet`), ou le mode secours (`rendu`) ;
 * - un blocage de la boucle de jeu (`blocage`, durée mesurée) ;
 * - une perte du contexte graphique (`contexte`) ;
 * - un rechargement de la page pendant une partie (`rechargement` : plantage ou fermeture forcée
 *   de l'onglet, souvent par manque de mémoire) ou une partie interrompue en arrière-plan ;
 * - un problème de son (`son`, `audio`).
 *
 * Rien n'est envoyé : tout reste dans le stockage local de l'appareil, borné (40 entrées), et le
 * rapport n'est copié que sur geste explicite. Aucune donnée personnelle n'y est écrite (pas de
 * pseudo, pas de score de classement) ; seules les caractéristiques techniques de l'appareil.
 */

export const DIAG_PREFIX = 'poc:diag:v1:';
export const MAX_DIAG_ENTRIES = 40;
/** Au-delà, une session de partie restée ouverte est trop ancienne pour être interprétée. */
export const STALE_SESSION_MS = 6 * 3600_000;
/** Battement de cœur pendant une partie : au plus une écriture toutes les 5 s. */
export const HEARTBEAT_MS = 5000;

export type DiagKind =
  | 'erreur' | 'rejet' | 'effet' | 'rendu' | 'evenement' | 'son' | 'blocage' | 'contexte'
  | 'rechargement' | 'arriere-plan' | 'audio' | 'qualite';

/** Contexte de la partie en cours, utile au diagnostic (jamais de données personnelles). */
export type RunInfo = {
  mode?: string;
  floor?: number;
  theme?: string;
  skin?: string;
  music?: string;
  effects?: string;
};

export type DiagEntry = {
  /** Instant ISO (horloge de l'appareil). */
  t: string;
  kind: DiagKind;
  msg: string;
  where?: string;
  stack?: string;
  ms?: number;
  /** Nombre d'occurrences identiques regroupées (au moins 1). */
  n: number;
  /** Partie en cours au moment de l'incident, s'il y en a une. */
  run?: RunInfo;
};

type Session = { start: number; beat: number; visible: boolean; closed: boolean; info: RunInfo };

export type DeviceInfo = Record<string, string | number | boolean | null>;

export type Diagnostics = {
  record(kind: DiagKind, msg: string, extra?: { where?: string; stack?: string; ms?: number }): void;
  entries(): DiagEntry[];
  clear(): void;
  /** Partie commencée : battement de cœur pour reconnaître un rechargement pendant la partie. */
  runStarted(info: RunInfo): void;
  /** Progression de la partie (au plus une écriture toutes les `HEARTBEAT_MS`). */
  runBeat(info: RunInfo, force?: boolean): void;
  /** Visibilité de la page pendant la partie (arrière-plan ou retour). */
  runVisibility(visible: boolean): void;
  /** Fin normale, abandon ou fermeture propre de la page : plus rien à interpréter. */
  runEnded(): void;
  /** Fermeture propre de la page (pagehide) : une partie ouverte n'est pas un plantage. */
  pageClosing(): void;
  /**
   * Au démarrage : une partie restée ouverte sans fin propre devient une entrée `rechargement`
   * (onglet visible) ou `arriere-plan` (onglet caché). Renvoie l'entrée ajoutée, ou null.
   */
  checkPreviousSession(): DiagEntry | null;
  /** Rapport texte à copier (appareil, incidents récents). */
  report(device: DeviceInfo): string;
};

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

function sanitizeInfo(raw: unknown): RunInfo {
  if (!isObj(raw)) return {};
  const out: RunInfo = {};
  for (const k of ['mode', 'theme', 'skin', 'music', 'effects'] as const) {
    const v = raw[k];
    if (typeof v === 'string') out[k] = clip(v, 32);
  }
  if (typeof raw.floor === 'number' && Number.isFinite(raw.floor)) out.floor = Math.max(0, Math.round(raw.floor));
  return out;
}

const KINDS: readonly DiagKind[] = ['erreur', 'rejet', 'effet', 'rendu', 'evenement', 'son', 'blocage', 'contexte', 'rechargement', 'arriere-plan', 'audio', 'qualite'];

function sanitizeEntry(raw: unknown): DiagEntry | null {
  if (!isObj(raw) || typeof raw.t !== 'string' || typeof raw.msg !== 'string') return null;
  if (!KINDS.includes(raw.kind as DiagKind)) return null;
  const e: DiagEntry = { t: clip(raw.t, 40), kind: raw.kind as DiagKind, msg: clip(raw.msg, 240), n: typeof raw.n === 'number' && raw.n >= 1 ? Math.min(9999, Math.floor(raw.n)) : 1 };
  if (typeof raw.where === 'string') e.where = clip(raw.where, 60);
  if (typeof raw.stack === 'string') e.stack = clip(raw.stack, 400);
  if (typeof raw.ms === 'number' && Number.isFinite(raw.ms)) e.ms = Math.round(raw.ms);
  if (isObj(raw.run)) e.run = sanitizeInfo(raw.run);
  return e;
}

/**
 * `storage` : localStorage (ou null : journal en mémoire seulement). `now` : horloge injectable.
 * Toute erreur de stockage est absorbée : le journal ne doit jamais casser le jeu qu'il observe.
 */
export function createDiagnostics(storage: Storage | null, now: () => number = () => Date.now()): Diagnostics {
  let memory: DiagEntry[] = [];
  let session: Session | null = null;
  let lastBeatWrite = 0;

  const read = (key: string): unknown => {
    if (!storage) return undefined;
    try {
      const raw = storage.getItem(DIAG_PREFIX + key);
      return raw === null ? undefined : (JSON.parse(raw) as unknown);
    } catch {
      return undefined;
    }
  };
  const write = (key: string, value: unknown) => {
    if (!storage) return;
    try {
      if (value === null) storage.removeItem(DIAG_PREFIX + key);
      else storage.setItem(DIAG_PREFIX + key, JSON.stringify(value));
    } catch {
      // Quota ou stockage bloqué : le journal reste en mémoire pour cette session.
    }
  };

  const load = (): DiagEntry[] => {
    const raw = read('journal');
    if (Array.isArray(raw)) memory = raw.map(sanitizeEntry).filter((e): e is DiagEntry => e !== null).slice(-MAX_DIAG_ENTRIES);
    return memory;
  };
  load();

  const iso = (ms: number) => {
    try {
      return new Date(ms).toISOString();
    } catch {
      return String(ms);
    }
  };

  const api: Diagnostics = {
    record(kind, msg, extra = {}) {
      const list = load();
      const last = list[list.length - 1];
      const text = clip(msg || '(sans message)', 240);
      const at = now();
      // Même incident répété dans les 10 s : regroupé (pas d'inondation du journal).
      if (last && last.kind === kind && last.msg === text && last.where === extra.where && at - Date.parse(last.t) < 10_000) {
        last.n += 1;
      } else {
        const entry: DiagEntry = { t: iso(at), kind, msg: text, n: 1 };
        if (extra.where) entry.where = clip(extra.where, 60);
        if (extra.stack) entry.stack = clip(extra.stack, 400);
        if (extra.ms !== undefined && Number.isFinite(extra.ms)) entry.ms = Math.round(extra.ms);
        if (session) entry.run = { ...session.info };
        list.push(entry);
      }
      memory = list.slice(-MAX_DIAG_ENTRIES);
      write('journal', memory);
    },
    entries: () => load().map((e) => ({ ...e })),
    clear() {
      memory = [];
      write('journal', null);
    },
    runStarted(info) {
      const at = now();
      session = { start: at, beat: at, visible: true, closed: false, info: sanitizeInfo(info) };
      lastBeatWrite = at;
      write('session', session);
    },
    runBeat(info, force = false) {
      if (!session) return;
      session.info = sanitizeInfo({ ...session.info, ...info });
      const at = now();
      if (!force && at - lastBeatWrite < HEARTBEAT_MS) return;
      session.beat = at;
      lastBeatWrite = at;
      write('session', session);
    },
    runVisibility(visible) {
      if (!session) return;
      session.visible = visible;
      session.beat = now();
      lastBeatWrite = session.beat;
      write('session', session);
    },
    runEnded() {
      session = null;
      write('session', null);
    },
    pageClosing() {
      if (!session) return;
      session.closed = true;
      write('session', session);
    },
    checkPreviousSession() {
      const raw = read('session');
      write('session', null);
      if (!isObj(raw) || typeof raw.beat !== 'number' || typeof raw.start !== 'number') return null;
      const prev: Session = {
        start: raw.start, beat: raw.beat, visible: raw.visible === true, closed: raw.closed === true, info: sanitizeInfo(raw.info),
      };
      const age = now() - prev.beat;
      if (prev.closed || age < 0 || age > STALE_SESSION_MS) return null;
      const lasted = Math.max(0, Math.round((prev.beat - prev.start) / 1000));
      const kind: DiagKind = prev.visible ? 'rechargement' : 'arriere-plan';
      const msg = prev.visible
        ? `La page a redémarré pendant une partie (dernier signe de vie après ${lasted} s de jeu, onglet visible) : plantage du navigateur ou fermeture forcée de l'onglet, souvent par manque de mémoire.`
        : `Une partie est restée ouverte en arrière-plan puis la page a redémarré : le système a pu fermer l'onglet (comportement normal des téléphones).`;
      const saved = session;
      session = { ...prev };
      api.record(kind, msg);
      session = saved;
      const list = load();
      return list[list.length - 1] ?? null;
    },
    report(device) {
      const lines = [
        'Stack or Crash — rapport de diagnostic local',
        `Créé le ${iso(now())}`,
        '',
        'Appareil :',
        ...Object.entries(device).map(([k, v]) => `- ${k} : ${v === null ? 'inconnu' : String(v)}`),
        '',
      ];
      const list = load();
      if (list.length === 0) lines.push('Aucun incident enregistré.');
      else {
        lines.push(`Incidents (${list.length}, du plus ancien au plus récent) :`);
        for (const e of list) {
          const run = e.run ? ` [partie : ${Object.entries(e.run).map(([k, v]) => `${k}=${v}`).join(', ')}]` : '';
          const extra = `${e.where ? ` (${e.where})` : ''}${e.ms !== undefined ? ` ${e.ms} ms` : ''}${e.n > 1 ? ` ×${e.n}` : ''}`;
          lines.push(`- ${e.t} ${e.kind}${extra} : ${e.msg}${run}`);
          if (e.stack) lines.push(`    pile : ${e.stack}`);
        }
      }
      return lines.join('\n');
    },
  };
  return api;
}

/** Caractéristiques techniques de l'appareil pour le rapport (aucune donnée personnelle). */
export function deviceInfo(win: Window | undefined = globalThis.window, version = ''): DeviceInfo {
  const nav = win?.navigator as (Navigator & { deviceMemory?: number }) | undefined;
  const perf = win?.performance as (Performance & { memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number } }) | undefined;
  const mb = (n: number | undefined) => (typeof n === 'number' ? Math.round(n / 1048576) : null);
  return {
    version: version || null,
    navigateur: nav?.userAgent ? clip(nav.userAgent, 200) : null,
    ecran: win ? `${win.screen?.width ?? '?'}×${win.screen?.height ?? '?'}` : null,
    fenetre: win ? `${win.innerWidth}×${win.innerHeight}` : null,
    densite: win?.devicePixelRatio ?? null,
    memoire_appareil_go: typeof nav?.deviceMemory === 'number' ? nav.deviceMemory : null,
    coeurs: typeof nav?.hardwareConcurrency === 'number' ? nav.hardwareConcurrency : null,
    tas_js_mo: mb(perf?.memory?.usedJSHeapSize),
    tas_js_limite_mo: mb(perf?.memory?.jsHeapSizeLimit),
  };
}

/**
 * Branche le journal sur les erreurs globales de la page et sur la fermeture propre.
 * Renvoie la fonction qui retire les écouteurs.
 */
export function attachDiagnostics(win: Window, diag: Diagnostics): () => void {
  const onError = (e: ErrorEvent) => {
    const where = e.filename ? `${e.filename.split('/').pop() ?? ''}:${e.lineno}:${e.colno}` : undefined;
    const stack = e.error instanceof Error && e.error.stack ? e.error.stack.split('\n').slice(1, 5).map((l) => l.trim()).join(' < ') : undefined;
    diag.record('erreur', e.message || String(e.error ?? 'erreur'), { ...(where ? { where } : {}), ...(stack ? { stack } : {}) });
  };
  const onRejection = (e: PromiseRejectionEvent) => {
    const r = e.reason as unknown;
    const msg = r instanceof Error ? `${r.name}: ${r.message}` : String(r);
    diag.record('rejet', msg);
  };
  const onPageHide = () => diag.pageClosing();
  win.addEventListener('error', onError);
  win.addEventListener('unhandledrejection', onRejection);
  win.addEventListener('pagehide', onPageHide);
  return () => {
    win.removeEventListener('error', onError);
    win.removeEventListener('unhandledrejection', onRejection);
    win.removeEventListener('pagehide', onPageHide);
  };
}
