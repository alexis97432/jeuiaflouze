#  Stack or Crash: music (V7)

## Rights and credits

Every track is an **original composition written for Stack or Crash**. The game contains **no external audio files**:
- each track is a score described in code (`src/app/music/tracks.ts`);
- the composer turns it into notes (`compose.ts`);
- the game's synthesizer renders those notes in the player's browser (`synth.ts`).

Licence: the repository's licence, with no third-party rights and no attribution owed. No library, sample or recording was integrated, so there is no external source to cite.

The in-game credits say so in Settings ("Musiques : compositions originales de Stack or Crash…"). This page serves as the credits in the repository.

## Musical direction

**Principles:**
- light background music, never louder than the sound effects;
- each universe has its own atmosphere;
- extra styles can be collected.

**Structure of a track:** four sections of 8 bars (16 for the waltz):
- A, the theme;
- B, the contrast;
- C, the lift: the most energetic;
- D, the breather.

**How sections are chained:**
- **Order:** the player picks the next section according to the height of the tower: the higher the tower, the more often the energetic sections come back. It never repeats the same section twice in a row.
- **Shared theme:** A and C share the same melodic motif, the recognisable theme of the track.
- **Joins:** sections are scheduled to the sample on the audio clock, 3 s ahead. Each one carries its own reverb tail, which overlaps the start of the next: there is no hard cut.

| Track | Rarity | Origin | Atmosphere |
|---|---|---|---|
| Sucre glace | Common | Confectionery universe | Sugary, bouncy pop, marimba |
| Rosée du matin | Rare | Garden universe | Pastoral, flute and harp |
| Apesanteur | Epic | Orbital universe | Space pads, distant bells |
| Lagon | Epic | Reef universe | Electric piano and bubbles, nonchalant tempo |
| Nocturne néon | Legendary | Neon City universe | Pulsing synthwave |
| Mirage | Common | Desert universe | Lute and percussion, phrygian dominant mode |
| Cimes | Rare | Mountain universe | Accordion, guitar |
| Manège | Epic | Funfair universe | Waltz, organ and glockenspiel |
| Hymne des nuées | Legendary | Kingdom of the Clouds universe | Strings, harp, horn |
| Premier étage | Common | **Free for everyone** | Gentle pop |
| Goûter lo-fi | Common | Shop, 90 coins | Muffled hip-hop, jazz chords |
| Pixel parade | Rare | Shop, 150 coins | Fast chiptune |
| Fanfare de poche | Rare | Shop, 150 coins | Brass and parade snare |
| Funk des briques | Epic | Shop, 240 coins | Funk bass, clavinet |
| Aurore polaire | Legendary | Shop, 420 coins | Luminous ambient |

A universe's music is owned together with the universe. The shop tracks are bought with in-game coins and stay owned when they leave the daily selection.

## Technical choices

**Rendering:**
- **Rendered offline:** each section is rendered once, in an OfflineAudioContext, mono at 22,050 Hz (about 1.5 to 2.6 MB per section).
- **During a game:** the player only plays buffers that are already rendered. Nothing is synthesised in real time, and the music does not depend on how smoothly the display runs.
- **When rendering happens:** in the menus. During a game, no rendering is started as soon as one section of the track is ready, so nothing stutters.
- **Memory:** at most 6 sections are kept. The buffers of a track you leave are freed.

**Audio hub** (`src/platform/audio-hub.ts`):
- a single AudioContext for music, effects and interface sounds;
- created on the player's first gesture, resumed on every gesture if the system has paused it;
- suspended in the background.

**Mix:**
- music bus fed through a ducking bus, with volume sliders squared;
- the music briefly dips under a perfect, a boost or a fall.

**Clean behaviour:**
- one track audible at a time, with a short crossfade between two tracks;
- a listen in the shop or collection stops the previous one and ends when you leave the screen, or after 20 s;
- nothing keeps playing after the player is destroyed.

## Checks actually performed (technical, not by ear)

**Measured in headless Chromium** (`OfflineAudioContext`), for the 15 tracks × 4 sections:
- no invalid values;
- peaks between −5 and −16 dBFS;
- RMS between −19 and −22 dBFS, depending on the section's energy;
- tail faded to below −46 dBFS at the end of the buffer.

**Joins:** at the junction of two sections, the largest jump between two samples stays below the largest jump measured in the surrounding ±0.25 s. There is no discontinuity at the join.

**Cost:**
- **Main thread:** 20 to 40 ms per section (building the graph).
- **Full rendering, off the display thread:** 0.2 to 2.2 s per section in this cloud container, which has no GPU. That is not a phone: the real duration on a modest device has not been measured.

**Unit tests** (`tests/app/v7-logic.test.ts`):
- deterministic composition, registers bounded;
- a single track audible;
- sources do not multiply;
- listen replaced, then stopped;
- no rendering during a game;
- end of life.

**Browser tests** (`tests/e2e/v7.spec.ts`):
- a single audio context across three games;
- listen stopped when changing screen;
- context suspended in the background, then resumed.

**Limit:** no track has been listened to by a person during this work, and nobody has judged the quality, the balance with the effects or listening comfort over many games.

WAV excerpts were produced in the session's scratchpad so a person can listen to them.
