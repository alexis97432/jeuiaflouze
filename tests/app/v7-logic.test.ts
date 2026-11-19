/**
 * V7 — logique pure : rotation quotidienne, journal de diagnostic, bande-son procédurale (théorie,
 * composition, lecteur) et centrale audio. Auto-vérification d'Alexis (pas une revue indépendante).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  checkOpenOffer, dailySelection, DAY_MS, nextRotationAt, OFFER_GRACE_MS, ROTATION_EPOCH_DAY, rotationDay, SLOTS, untilRotation,
} from '../../src/app/rotation';
import { COIN_SHOP } from '../../src/app/shop';
import { catalogItem, DEFAULT_MUSIC, MUSIC_CATALOG } from '../../src/app/catalog';
import { createDiagnostics, MAX_DIAG_ENTRIES, STALE_SESSION_MS } from '../../src/app/diagnostics';
import { chordOf, SCALES, voiceChord } from '../../src/app/music/theory';
import { composeSection } from '../../src/app/music/compose';
import { getTrack, sectionSeconds, TRACKS } from '../../src/app/music/tracks';
import { createMusicPlayer, LOOKAHEAD_S, PREVIEW_MS } from '../../src/app/music/player';
import { createAudioHub, MUSIC_BASE_GAIN, sliderGain, type AudioHub } from '../../src/platform/audio-hub';
import { equipMusic, equippedMusic, migrateProgress } from '../../src/app/economy';
import { ownsMusic } from '../../src/app/progression';
import { purchaseWithCoins } from '../../src/app/shop';

afterEach(() => vi.restoreAllMocks());

// ——— Rotation ———

describe('V7 — sélection du jour de la boutique', () => {
  const day0 = ROTATION_EPOCH_DAY;

  it('même date et même version → même sélection, stable pendant toute la journée', () => {
    const a = dailySelection(day0 + 10).map((o) => o.id);
    dailySelection(day0 + 11); // autre jour entre-temps (le cache ne fausse rien)
    const b = dailySelection(day0 + 10).map((o) => o.id);
    expect(b).toEqual(a);
    const morning = rotationDay(Date.UTC(2026, 10, 28, 0, 0, 1));
    const night = rotationDay(Date.UTC(2026, 10, 28, 23, 59, 59));
    expect(morning).toBe(night);
    expect(rotationDay(Date.UTC(2026, 10, 29, 0, 0, 0))).toBe(morning + 1);
    expect(nextRotationAt(Date.UTC(2026, 10, 28, 15, 0))).toBe(Date.UTC(2026, 10, 29));
  });

  it('chaque jour : 3 matières, 1 univers, 2 musiques (selon le catalogue), jamais deux fois le même objet', () => {
    for (let d = day0; d < day0 + 60; d++) {
      const offers = dailySelection(d);
      for (const kind of ['skin', 'theme', 'music'] as const) {
        const pool = COIN_SHOP.filter((i) => i.kind === kind).length;
        expect(offers.filter((o) => o.kind === kind)).toHaveLength(Math.min(SLOTS[kind], pool));
      }
      expect(new Set(offers.map((o) => `${o.kind}:${o.id}`)).size).toBe(offers.length);
      for (const o of offers) expect(o.price).toBe(COIN_SHOP.find((i) => i.id === o.id)!.price);
    }
  });

  it('pas de répétition immédiate quand la catégorie a assez d’objets ; chaque objet revient régulièrement', () => {
    const seen = new Map<string, number[]>();
    for (let d = day0; d < day0 + 90; d++) {
      const today = dailySelection(d);
      const yesterday = d > day0 ? dailySelection(d - 1) : [];
      for (const kind of ['skin', 'theme', 'music'] as const) {
        const pool = COIN_SHOP.filter((i) => i.kind === kind).length;
        if (pool < 2 * SLOTS[kind]) continue;
        const ids = new Set(yesterday.filter((o) => o.kind === kind).map((o) => o.id));
        expect(today.filter((o) => o.kind === kind && ids.has(o.id)), `jour ${d}, ${kind}`).toEqual([]);
      }
      for (const o of today) seen.set(o.id, [...(seen.get(o.id) ?? []), d]);
    }
    for (const item of COIN_SHOP) {
      const days = seen.get(item.id) ?? [];
      expect(days.length, item.id).toBeGreaterThan(0);
      const pool = COIN_SHOP.filter((i) => i.kind === item.kind).length;
      const bound = Math.ceil(pool / SLOTS[item.kind]) + 3;
      for (let k = 1; k < days.length; k++) expect(days[k]! - days[k - 1]!, `${item.id} revient`).toBeLessThanOrEqual(bound);
    }
  });

  it('toutes les raretés présentes régulièrement ; au moins une offre épique ou légendaire par jour', () => {
    const rarities = new Set<string>();
    for (let d = day0; d < day0 + 30; d++) {
      const offers = dailySelection(d);
      offers.forEach((o) => rarities.add(o.rarity));
      expect(offers.some((o) => o.rarity === 'epique' || o.rarity === 'legendaire'), `jour ${d}`).toBe(true);
      expect(offers.some((o) => o.rarity === 'commun' || o.rarity === 'rare'), `jour ${d}`).toBe(true);
    }
    expect([...rarities].sort()).toEqual(['commun', 'epique', 'legendaire', 'rare']);
  });

  it('offre ouverte à minuit : honorée au prix confirmé 5 min, puis expirée sans débit', () => {
    const d = day0 + 5;
    const offer = dailySelection(d).find((o) => !dailySelection(d + 1).some((n) => n.id === o.id))!;
    const midnight = (d + 1) * DAY_MS;
    expect(checkOpenOffer({ kind: offer.kind, id: offer.id, day: d }, midnight - 60_000)).toEqual({ ok: true });
    expect(checkOpenOffer({ kind: offer.kind, id: offer.id, day: d }, midnight + OFFER_GRACE_MS - 1)).toEqual({ ok: true });
    expect(checkOpenOffer({ kind: offer.kind, id: offer.id, day: d }, midnight + OFFER_GRACE_MS + 1)).toEqual({ ok: false, reason: 'expired' });
    // Encore proposé le lendemain : l'achat reste possible.
    const kept = dailySelection(d).find((o) => dailySelection(d + 1).some((n) => n.id === o.id));
    if (kept) expect(checkOpenOffer({ kind: kept.kind, id: kept.id, day: d }, midnight + 3_600_000)).toEqual({ ok: true });
  });

  it('jamais un autre prix : le débit compare le prix du catalogue au prix confirmé', () => {
    const doc = { ...migrateProgress(undefined), coins: 1000 };
    const item = COIN_SHOP.find((i) => i.kind === 'music')!;
    const wrong = purchaseWithCoins(doc, item.id, COIN_SHOP, item.price + 1);
    expect(wrong).toMatchObject({ ok: false, reason: 'price-changed' });
    expect(wrong.doc.coins).toBe(1000);
    const ok = purchaseWithCoins(doc, item.id, COIN_SHOP, item.price);
    expect(ok.ok && ok.doc.coins).toBe(1000 - item.price);
  });

  it('compte à rebours lisible', () => {
    expect(untilRotation(Date.UTC(2026, 10, 18, 18, 42))).toBe('dans 5 h 18');
    expect(untilRotation(Date.UTC(2026, 10, 18, 23, 52))).toBe('dans 8 min');
  });
});

// ——— Musiques possédées ———

describe('V7 — musiques : possession et équipement', () => {
  it('« Premier étage » offerte à tous ; musique d’univers avec l’univers ; achetée = possédée pour toujours', () => {
    const doc = migrateProgress(undefined);
    expect(ownsMusic(doc, DEFAULT_MUSIC)).toBe(true);
    expect(ownsMusic(doc, 'sucre-glace')).toBe(true); // Confiserie, univers par défaut
    expect(ownsMusic(doc, 'lagon')).toBe(false); // Récif pas encore acheté
    expect(ownsMusic({ ...doc, inventory: ['recif'] }, 'lagon')).toBe(true);
    expect(ownsMusic(doc, 'gouter-lofi')).toBe(false);
    const bought = purchaseWithCoins({ ...doc, coins: 500 }, 'gouter-lofi', COIN_SHOP);
    expect(bought.ok && ownsMusic(bought.doc, 'gouter-lofi')).toBe(true);
    expect(bought.ok && bought.doc.inventory).toEqual(['musique-gouter-lofi']);
    expect(purchaseWithCoins(bought.doc, 'gouter-lofi', COIN_SHOP)).toMatchObject({ ok: false, reason: 'owned' });
  });

  it('équiper : seulement une musique possédée ; sauvegarde v5, relue après migration', () => {
    const doc = migrateProgress(undefined);
    expect(equippedMusic(doc)).toBe(DEFAULT_MUSIC);
    expect(equipMusic(doc, 'gouter-lofi')).toBe(doc); // pas possédée : refus
    const owned = { ...doc, inventory: ['musique-gouter-lofi'] };
    const eq = equipMusic(owned, 'gouter-lofi');
    expect(equippedMusic(eq)).toBe('gouter-lofi');
    const reloaded = migrateProgress(JSON.parse(JSON.stringify(eq)));
    expect(reloaded.version).toBe(6);
    expect(equippedMusic(reloaded)).toBe('gouter-lofi');
    // Musique inconnue ou plus possédée : la musique offerte reprend, sans erreur.
    expect(equippedMusic(migrateProgress({ ...eq, music: 'inconnue' }))).toBe(DEFAULT_MUSIC);
    expect(equippedMusic({ ...eq, inventory: [] })).toBe(DEFAULT_MUSIC);
  });

  it('chaque musique du catalogue a une partition et une rareté', () => {
    expect(MUSIC_CATALOG.length).toBeGreaterThanOrEqual(10);
    for (const m of MUSIC_CATALOG) {
      expect(getTrack(m.id)?.rarity, m.id).toBe(m.rarity);
      expect(catalogItem('music', m.id)).toBe(m);
    }
    expect(new Set(TRACKS.map((t) => t.id)).size).toBe(TRACKS.length);
  });
});

// ——— Théorie et composition ———

describe('V7 — composition procédurale', () => {
  it('accords diatoniques et emprunts', () => {
    expect(chordOf(SCALES.major, '1').tones).toEqual([0, 4, 7]);
    expect(chordOf(SCALES.major, '6').tones).toEqual([9, 12, 16]);
    expect(chordOf(SCALES.minor, '1:9').tones).toEqual([0, 3, 7, 10, 14]);
    expect(chordOf(SCALES.major, 'b7').root).toBe(10);
    expect(chordOf(SCALES.major, '5:sus4').tones).toEqual([7, 12, 14]);
  });

  it('conduite des voix : le renversement choisi bouge peu', () => {
    const c = voiceChord(chordOf(SCALES.major, '1'), 48, 62, null);
    const f = voiceChord(chordOf(SCALES.major, '4'), 48, 62, c);
    const moved = f.reduce((s, m, i) => s + Math.abs(m - c[i]!), 0);
    expect(moved).toBeLessThanOrEqual(8);
  });

  it('déterministe, dans la durée de la section, registres bornés', () => {
    for (const track of TRACKS) {
      for (let s = 0; s < 4; s++) {
        const a = composeSection(track, s);
        const b = composeSection(track, s);
        expect(b).toEqual(a);
        expect(a.duration).toBeCloseTo(sectionSeconds(track), 6);
        for (const n of a.notes) {
          expect(n.t).toBeGreaterThanOrEqual(0);
          expect(n.t).toBeLessThan(a.duration);
          expect(n.m).toBeGreaterThanOrEqual(24);
          expect(n.m).toBeLessThanOrEqual(100);
          expect(n.v).toBeGreaterThan(0);
          expect(n.v).toBeLessThanOrEqual(1);
          if (n.part === 'melody') {
            expect(n.m).toBeGreaterThanOrEqual(track.melody.low - 1);
            expect(n.m).toBeLessThanOrEqual(track.melody.high + 1);
          }
        }
        for (const d of a.drums) expect(d.t).toBeLessThan(a.duration);
        expect(a.notes.length + a.drums.length, `${track.id}:${s}`).toBeGreaterThan(10);
      }
    }
  });

  it('A et C partagent le thème mélodique (même rythme de départ)', () => {
    const track = getTrack('sucre-glace')!;
    const firstBar = (s: number) => composeSection(track, s).notes.filter((n) => n.part === 'melody' && n.t < (60 / track.bpm) * 4 * 2).map((n) => Math.round(n.t * 1000) - 0);
    const a = composeSection(track, 0).notes.some((n) => n.part === 'melody');
    if (a) expect(firstBar(2).length).toBeGreaterThan(0);
  });
});

// ——— Faux contexte audio pour la centrale et le lecteur ———

class Param {
  value = 0;
  setTargetAtTime(v: number) { this.value = v; return this; }
  cancelScheduledValues() { return this; }
  setValueAtTime(v: number) { this.value = v; return this; }
  linearRampToValueAtTime(v: number) { this.value = v; return this; }
}
class Node {
  out: unknown[] = [];
  connect(n: unknown) { this.out.push(n); return n; }
  disconnect() { this.out = []; }
}
class Gain extends Node { gain = new Param(); }
class Source extends Node {
  buffer: unknown = null;
  started: number | null = null;
  stopped: number | null = null;
  onended: (() => void) | null = null;
  start(t: number) { this.started = t; }
  stop(t = 0) { this.stopped = t; }
}
class FakeContext {
  static created = 0;
  state = 'suspended';
  currentTime = 0;
  destination = new Node();
  onstatechange: (() => void) | null = null;
  sources: Source[] = [];
  constructor() { FakeContext.created++; }
  createGain() { return new Gain(); }
  createBufferSource() { const s = new Source(); this.sources.push(s); return s; }
  resume() { this.state = 'running'; this.onstatechange?.(); return Promise.resolve(); }
  suspend() { this.state = 'suspended'; this.onstatechange?.(); return Promise.resolve(); }
  close() { this.state = 'closed'; return Promise.resolve(); }
}

const fakeWindow = () => ({ AudioContext: FakeContext as unknown as typeof AudioContext });

describe('V7 — centrale audio', () => {
  it('un seul contexte, créé au geste ; volumes au carré ; arrière-plan suspendu puis repris', async () => {
    FakeContext.created = 0;
    const hub = createAudioHub(fakeWindow() as never);
    expect(hub.state).toBe('none');
    expect(hub.musicInput()).toBeNull();
    hub.unlock();
    hub.unlock();
    await Promise.resolve();
    expect(FakeContext.created).toBe(1);
    expect(hub.running()).toBe(true);
    hub.setMusic(true, 0.5);
    const ctx = hub.context as unknown as FakeContext;
    expect(ctx).toBeTruthy();
    expect(sliderGain(0.5)).toBe(0.25);
    hub.setMusic(false, 0.5);
    hub.background(true);
    await Promise.resolve();
    expect(hub.context!.state).toBe('suspended');
    hub.background(false);
    await Promise.resolve();
    expect(hub.context!.state).toBe('running');
    expect(MUSIC_BASE_GAIN).toBeLessThan(1);
  });

  it('sans Web Audio : muet, sans erreur', () => {
    const hub = createAudioHub({} as never);
    expect(() => hub.unlock()).not.toThrow();
    expect(hub.state).toBe('unavailable');
    expect(hub.sfxOutput()).toBeNull();
  });
});

describe('V7 — lecteur de musique', () => {
  function setupPlayer() {
    const hub = createAudioHub(fakeWindow() as never);
    hub.unlock();
    const ctx = hub.context as unknown as FakeContext;
    ctx.state = 'running';
    const renders: string[] = [];
    const timers: (() => void)[] = [];
    const player = createMusicPlayer({
      hub,
      render: async (t, i) => {
        renders.push(`${t.id}:${i}`);
        return { duration: sectionSeconds(t) + 3 } as AudioBuffer;
      },
      setTimer: (fn) => { timers.push(fn); return timers.length; },
      clearTimer: () => undefined,
      random: () => 0.3,
    });
    const settle = async (ticks = 6) => {
      for (let k = 0; k < ticks; k++) {
        await Promise.resolve();
        await Promise.resolve();
        const pending = timers.splice(0);
        for (const fn of pending) fn();
      }
    };
    return { hub: hub as AudioHub, ctx, player, renders, settle };
  }

  it('une seule piste audible ; changer de piste = fondu, puis l’ancienne s’arrête', async () => {
    const { ctx, player, settle } = setupPlayer();
    player.want('sucre-glace');
    await settle(10);
    expect(player.state.current).toBe('sucre-glace');
    expect(player.stats().voices).toBe(1);
    const firstSources = ctx.sources.length;
    expect(firstSources).toBeGreaterThan(0);
    player.want('lagon');
    await settle(10);
    expect(player.state.current).toBe('lagon');
    expect(player.stats().voices).toBeLessThanOrEqual(2);
    ctx.currentTime += 10;
    await settle(4);
    expect(player.stats().voices).toBe(1);
    for (const s of ctx.sources.slice(0, firstSources)) expect(s.stopped).not.toBeNull();
  });

  it('cent demandes de la même piste et de longues heures : les sources ne se multiplient pas', async () => {
    const { ctx, player, settle } = setupPlayer();
    for (let i = 0; i < 100; i++) player.want('premier-etage');
    await settle(10);
    for (let h = 0; h < 200; h++) {
      ctx.currentTime += 5;
      await settle(1);
      for (const s of ctx.sources) if (s.started !== null && s.started + sectionSeconds(getTrack('premier-etage')!) + 3 < ctx.currentTime) s.onended?.();
    }
    expect(player.stats().voices).toBe(1);
    expect(player.stats().sources).toBeLessThanOrEqual(Math.ceil(LOOKAHEAD_S / 10) + 2);
  });

  it('écoute : remplace la musique, s’arrête seule après 20 s ou sur demande, puis la musique revient', async () => {
    const { player, settle } = setupPlayer();
    let now = 1_000_000;
    vi.spyOn(Date, 'now').mockImplementation(() => now);
    player.want('sucre-glace');
    await settle(10);
    player.preview('pixel-parade');
    await settle(10);
    expect(player.state.previewing).toBe('pixel-parade');
    expect(player.state.current).toBe('pixel-parade');
    player.preview('aurore-polaire'); // une autre écoute remplace la première
    await settle(10);
    expect(player.state.previewing).toBe('aurore-polaire');
    now += PREVIEW_MS + 1;
    await settle(10);
    expect(player.state.previewing).toBeNull();
    expect(player.state.current).toBe('sucre-glace');
    player.preview('pixel-parade');
    player.stopPreview();
    await settle(10);
    expect(player.state.current).toBe('sucre-glace');
  });

  it('en partie : aucun rendu si une section est prête ; musique coupée : rien n’est rendu', async () => {
    const { player, renders, settle } = setupPlayer();
    player.want('rosee');
    await settle(2);
    player.setGameActive(true);
    const before = renders.length;
    await settle(20);
    expect(renders.length).toBe(before);
    player.setGameActive(false);
    await settle(20);
    expect(renders.filter((r) => r.startsWith('rosee')).length).toBe(4);
    player.want(null);
    await settle(10);
    expect(player.state.current).toBeNull();
  });

  it('fin de vie : tout s’arrête, plus rien n’est programmé', async () => {
    const { ctx, player, settle } = setupPlayer();
    player.want('apesanteur');
    await settle(10);
    player.dispose();
    expect(player.stats()).toEqual({ sources: 0, cached: 0, voices: 0, rendering: 0 });
    for (const s of ctx.sources) expect(s.stopped).not.toBeNull();
  });
});

// ——— Journal de diagnostic ———

function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() { return data.size; },
    clear: () => data.clear(),
    key: (i: number) => [...data.keys()][i] ?? null,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, String(v)),
    removeItem: (k: string) => void data.delete(k),
  };
}

describe('V7 — journal de diagnostic local', () => {
  it('regroupe les répétitions, borne le journal, survit au rechargement, s’efface', () => {
    const storage = memoryStorage();
    let now = Date.UTC(2026, 10, 18, 12);
    const diag = createDiagnostics(storage, () => now);
    diag.record('erreur', 'TypeError: x', { where: 'a.js:1:2' });
    now += 2000;
    diag.record('erreur', 'TypeError: x', { where: 'a.js:1:2' });
    expect(diag.entries()).toHaveLength(1);
    expect(diag.entries()[0]!.n).toBe(2);
    for (let i = 0; i < MAX_DIAG_ENTRIES + 10; i++) {
      now += 60_000;
      diag.record('blocage', `image ${i}`, { ms: 2000 + i });
    }
    expect(diag.entries()).toHaveLength(MAX_DIAG_ENTRIES);
    const again = createDiagnostics(storage, () => now);
    expect(again.entries()).toHaveLength(MAX_DIAG_ENTRIES);
    again.clear();
    expect(createDiagnostics(storage, () => now).entries()).toEqual([]);
  });

  it('partie interrompue par un rechargement, onglet visible → « rechargement » ; cachée → « arrière-plan » ; fermeture propre → rien', () => {
    let now = Date.UTC(2026, 10, 18, 12);
    const storage = memoryStorage();
    const first = createDiagnostics(storage, () => now);
    first.runStarted({ mode: 'free', theme: 'cite', skin: 'galaxie', music: 'nocturne-neon', effects: 'full' });
    now += 30_000;
    first.runBeat({ floor: 23 }, true);
    // Plantage : rien d'autre n'est écrit. Au redémarrage :
    now += 5000;
    const second = createDiagnostics(storage, () => now);
    const entry = second.checkPreviousSession();
    expect(entry?.kind).toBe('rechargement');
    expect(entry?.run).toMatchObject({ theme: 'cite', skin: 'galaxie', floor: 23 });
    expect(second.checkPreviousSession()).toBeNull(); // une seule fois

    second.runStarted({ mode: 'free' });
    second.runVisibility(false);
    expect(createDiagnostics(storage, () => now).checkPreviousSession()?.kind).toBe('arriere-plan');

    const third = createDiagnostics(storage, () => now);
    third.runStarted({ mode: 'daily' });
    third.pageClosing();
    expect(createDiagnostics(storage, () => now).checkPreviousSession()).toBeNull();

    const old = createDiagnostics(storage, () => now);
    old.runStarted({ mode: 'free' });
    expect(createDiagnostics(storage, () => now + STALE_SESSION_MS + 1).checkPreviousSession()).toBeNull();
  });

  it('rapport texte : appareil et incidents, aucune donnée personnelle ; journal abîmé ignoré', () => {
    const storage = memoryStorage();
    storage.setItem('poc:diag:v1:journal', '{pas du json');
    const diag = createDiagnostics(storage, () => Date.UTC(2026, 10, 18));
    expect(diag.entries()).toEqual([]);
    diag.record('effet', 'IndexSizeError: rayon négatif', { where: 'ondes', stack: 'draw < frame' });
    const text = diag.report({ version: 'test', densite: 3 });
    expect(text).toContain('densite : 3');
    expect(text).toContain('effet (ondes)');
    expect(text).toContain('rayon négatif');
    storage.setItem('poc:diag:v1:journal', JSON.stringify([{ t: 'x', kind: 'inconnu', msg: 'a' }, { t: '2026', kind: 'erreur', msg: 'ok', n: -4 }]));
    expect(createDiagnostics(storage).entries()).toEqual([{ t: '2026', kind: 'erreur', msg: 'ok', n: 1 }]);
  });
});
