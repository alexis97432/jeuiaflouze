# Moteur F0 — règles déterministes, rulesVersion 1

Propriétaire : Claude Code FLK. Consommateurs : rendu F1, shell A1 (via `src/game/index.ts`), futur serveur F2/A2.
Le dossier n'importe ni DOM, ni horloge, ni `Math.random`, ni stockage, ni réseau : il se compile avec `lib: ["ES2022"]` et `types: []`.

## Unités

Toute la géométrie est en **milli** (millièmes d'unité logique), en entiers : terrain 360000, bloc de départ 240000, base initiale `left = 60000`, tolérance parfait 4000.
C'est la forme la plus stricte de « arrondir au millième à chaque tick » du contrat v0 : la vitesse d'un étage est arrondie une seule fois en milli/tick entier, puis le déplacement et la découpe ne font que des additions entières. Le rejeu est donc exact dans tout langage disposant d'entiers 32 bits et d'un flottant IEEE-754 double pour le seul calcul de vitesse.

## PRNG

xorshift32, décalages 13 / 17 / 5, `>>> 0` après chaque étape, seed entière dans `[1, 2^32 − 1]`. Le tirage est l'état après itération ; seed 1 → 270369, 67634689, 2647435461.
Exactement **un tirage par étage**, au moment où l'étage apparaît, y compris le premier.

## Vitesse d'un étage `n` (n = 1 pour le premier bloc mobile)

```
base   = min(90 + 3·(n − 1), 210)              unités/s, plafond AVANT modulation
factor = 0.9 + 0.2 · (tirage / 2^32)           dans [0.9, 1.1[
speed  = Math.round(base · factor · 1000 / 120) milli/tick (demi vers +∞)
```
Vitesse effective : de 675 à 1925 milli/tick (81 à 231 u/s).

## Départ et trajet

- Étage impair : `left = 0`, direction +1 (premier déplacement vers la droite).
- Étage pair : `left = 360000 − largeur`, direction −1.
- Le bloc mobile a la largeur de la base courante. Trajet triangulaire dans `[0, 360000 − largeur]` ; un dépassement est réfléchi au milli près (`2·max − pos` ou `−pos`).

## Ordre d'un tick

État initial = tick 0 (étage 1 apparu, pas encore déplacé). Pour chaque `step(press)` :

1. `tick += 1` ;
2. déplacement du bloc mobile ;
3. si `press` : pose (au plus une par tick ; plusieurs appuis attribués au même tick n'en font qu'un) ;
4. si posé : l'étage suivant apparaît (tirage, position de départ) et ne bouge qu'au tick suivant.

Le premier appui possible est donc au tick 1. Après un raté, `step` renvoie `null` et plus rien ne change.

## Pose

1. Intersection `min(droites) − max(gauches) ≤ 0` (bords qui se touchent inclus) → **raté**, fin de partie. Ce test passe avant la tolérance parfait : une base plus étroite que 4 unités peut être ratée malgré un écart ≤ 4.
2. `|gauche mobile − gauche base| ≤ 4000` (borne incluse) → **parfait** : la nouvelle base est la base elle-même, rien ne tombe.
3. Sinon la nouvelle base est exactement l'intersection ; un seul débord tombe (`cut`).

Score = nombre d'étages posés. `perfectCount` = nombre de poses parfaites ; la série courante et la meilleure série sont informatives (événements et getters), sans effet sur le score. Le premier étage ne peut pas être raté (240 u au-dessus d'une base centrée de 240 u) : c'est voulu, un premier geste ne punit pas.

## Résultat et rejeu

`RunResult.durationTicks` = tick du raté ; `inputTicks` = ticks des poses acceptées, strictement croissants, le dernier étant le raté.

```ts
replayRun(input: unknown, limits?: ReplayLimits): ReplayOutcome
verifyRunResult(claimed: unknown, limits?: ReplayLimits): ReplayOutcome
type ReplayOutcome = { ok: true; result: RunResult } | { ok: false; error: ReplayErrorCode; detail: string };
```

Un rejeu valide a : `rulesVersion === 1`, seed valide, `inputTicks` tableau d'entiers sûrs ≥ 1 strictement croissants (un doublon est rejeté, pas fusionné), au plus `maxInputs` entrées (vérifié avant simulation), dernière entrée ≤ `maxTicks`, chaque entrée pose sauf la dernière, qui rate.
Codes : `malformed`, `bad_seed`, `bad_rules_version`, `bad_input_ticks`, `too_many_inputs`, `too_long`, `not_ended`, `input_after_end`, `mismatch`. Limites par défaut : 432000 ticks (1 h) et 20000 entrées ; un serveur peut les resserrer.
Un rejeu valide prouve qu'une suite d'entrées produit ce score, pas qu'un humain l'a jouée.

## API de simulation pour F1

`new Simulation(config)` ; `step(press): StepEvent | null` ; getters `tick`, `status`, `score`, `floor`, `base`, `moving`, `direction`, `speed`, `perfectCount`, `perfectStreak`, `bestPerfectStreak`, `stack`, `inputTicks` ; `result()`.
`StepEvent` décrit la pose (`placed`, `cut`, `perfect`, `perfectStreak`) ou le raté (`moving`), pour déclencher rendu et son sans recalculer les règles.

## Points du contrat v0 précisés ici (à confirmer par Codex)

- vitesse arrondie en milli/tick entier au lieu d'un arrondi des positions flottantes ;
- plafond 210 appliqué avant la modulation ±10 % ;
- « départ alternant » formalisé : impair à gauche vers la droite, pair à droite vers la gauche ;
- raté prioritaire sur parfait ; bords qui se touchent = raté ;
- rejeu strict : doublons et désordre rejetés au lieu d'être normalisés.
