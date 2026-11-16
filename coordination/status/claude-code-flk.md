# Claude Code FLK

## F0 — moteur pur

- État : **REVIEW_PENDING** (revue Codex demandée, non reçue). Pas DONE tant qu'il n'y a ni PASS externe ni intégration.
- Branche : `agent/claude-code-flk/f0-core`, créée depuis `claude/youthful-mayer-n4f7oy` @ `c79f5c80246eb8264a204456b0236abfc33629ad`. Le SHA livré est la tête de cette branche et figure dans la PR F0.
- Fichiers : `src/game/core/` (constants, prng, geometry, simulation, replay, index, README de règles) et `tests/game/` (core.test.ts, replay.test.ts, golden-v1.json, bot.ts, fingerprint.ts).
- Spécification exacte des ticks, de la géométrie, des parfaits, du PRNG, du résultat et du rejeu : [src/game/core/README.md](../../src/game/core/README.md).
- Contrôles réels, le 16 novembre 2026, Node 22.23.4, avec un outillage temporaire hors dépôt (A0 absent, voir ci-dessous) :
  - `vitest 3.2.4 run tests/game` → 2 fichiers, **77 tests passés** ;
  - `tsc 5.9.3 --noEmit`, mode strict + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes` : core seul avec `lib: ES2022` et `types: []` (preuve qu'il n'y a pas de DOM) → OK ; core + tests → OK ;
  - mutations manuelles détectées : tolérance `<` au lieu de `≤` (5 échecs), bords qui se touchent acceptés (1 échec), pose avant déplacement (15 échecs) ;
  - rejeu de 432000 ticks (durée maximale par défaut) mesuré à 28,9 ms sur ce conteneur cloud. C'est une seule mesure, pas un benchmark ; aucune mesure de FPS ni sur téléphone.
- Vecteurs golden : 6 parties produites par un bot déterministe (seeds 1, 42, 123456789, 2026, 2^32−1), avec 0 à 30 parfaits. Le premier vecteur et les cas de `core.test.ts` sont recalculés **à la main** dans les commentaires des tests, pas seulement recopiés du moteur.
- Limite : la cadence 30/60/120 Hz n'est testée ici que comme découpage des ticks en lots par image (même pile au tick près). Le lien avec l'horloge réelle et l'horodatage des appuis relève de F1.

### Dépendances proposées à Alexis (A0 non livré, je ne touche pas aux fichiers racine)

- devDependencies : `typescript`, `vitest` (testé avec 5.9.3 / 3.2.4).
- tsconfig : `strict`, `noUncheckedIndexedAccess`, `resolveJsonModule` (les tests importent `golden-v1.json`), `moduleResolution: "Bundler"`, imports relatifs sans extension.
- `npm test` doit inclure `tests/game/**/*.test.ts`. Suggestion : un tsconfig ou une règle de lint qui interdit `DOM` dans `src/game/core/`.
- `node_modules` à ignorer dans `.gitignore` : un lien symbolique local existe chez moi et n'est pas commité.

### Précisions du contrat v0 que je propose (à confirmer par Codex, sans modifier docs/CONTRACTS.md moi-même)

1. Vitesse arrondie une fois en milli/tick entier au lieu d'arrondir des positions flottantes à chaque tick : même intention, rejeu exact et portable.
2. Plafond 210 appliqué avant la modulation ±10 % (vitesse effective jusqu'à 231 u/s). Variante : plafond après modulation.
3. Départ : étage impair au bord gauche vers la droite, étage pair au bord droit vers la gauche.
4. Raté prioritaire sur parfait ; bords qui se touchent = raté.
5. Signature du rejeu : `replayRun(input: unknown, limits?) → { ok: true, result } | { ok: false, error, detail }`, plus `verifyRunResult`. Doublons et désordre sont rejetés, pas normalisés.

## Revue du voisin (FLK vérifie Alexis)

- A0 : **pas de livraison disponible** le 16 novembre 2026. Ni PR ni branche `agent/claude-code-alexis/*` sur le dépôt distant ; branches distantes vues : `claude/youthful-mayer-n4f7oy` et `claude/blissful-galileo-26o0ep`, sans PR ouverte. Revue A0 en attente ; aucun verdict inventé.

## Avis indépendant sur le concept (demandé pour M0)

1. Faiblesse principale : le jeu d'empilement à un geste est un genre très exploré. La règle ne différencie rien, la sensation de pose (son, rythme des parfaits, lisibilité) porte tout. Un rendu moyen donnera probablement un clone de plus.
2. Le « défi sur la même séquence » est peu perceptible : la seed ne module que ±10 % de vitesse. Deux amis vivent presque la même partie qu'en mode libre, donc le défi se réduit à un score cible. Ce n'est pas un défaut technique, mais l'argument « même séquence » est faible tel quel.
3. Risque de rythme : les parfaits gardent la largeur et la vitesse plafonne. Un joueur précis peut faire des parties longues et monotones. À mesurer en playtest : durée médiane, étage du premier raté.
4. Concept concurrent à tester : « la tour du jour ». Une seed quotidienne UTC commune, trois essais, et une carte de résultat sans spoiler (une ligne de symboles par pose : parfait, coupe faible, coupe forte). Même moteur, sans backend en M1. La carte donne une raison de partager que le score seul n'offre pas.
5. Test pour départager : dans le playtest de 10 personnes de VALIDATION.md, alterner deux écrans de résultat (défi ami / tour du jour) et noter le rejeu spontané et l'intention déclarée de partager, plus les verbatims. Signal qualitatif uniquement, non extrapolable.
6. Recommandation : garder le prototype actuel (il est compatible), concentrer F1 sur la sensation de pose, et préparer la tour du jour comme variante d'écran de résultat, pas comme second moteur. Si l'on veut que la seed se voie, il faudrait une variation perceptible (par exemple vitesse par motifs), donc rulesVersion 2 et une décision Codex.

## Prochain pas

- Attendre la revue Codex de F0 et corriger les éventuels bloquants sur un nouveau SHA.
- Revoir A0 dès qu'il sera livré.
- Démarrer F1 (rendu Canvas, entrée, boucle à pas fixe) sur une branche distincte, en consommant `Simulation` et `StepEvent` sans dupliquer les règles.
