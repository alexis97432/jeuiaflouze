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

# Règles v2 (`rulesVersion: 2`, `v2.ts`) — V3, proposition F6 en attente de revue Codex

La v1 ci-dessus reste **inchangée** : même classe `Simulation`, même golden `tests/game/golden-v1.json`. La v2 reprend la géométrie, le PRNG (un tirage par étage), la vitesse de base et l'ordre d'un tick de la v1, puis ajoute :

## Jauge et bonus
- Une pose réussie **hors bonus** ajoute à la jauge : +1 (non parfaite), +2 (parfaite), +3 (parfaite avec série ≥ 3 après la pose). Capacité `GAUGE_MAX = 10`.
- Jauge ≥ 10 à une pose → bonus immédiat, jauge remise à 0 (excédent perdu). Alternance fixe : 1er `ralenti`, 2e `double`, 3e `ralenti`… (`nextBonus`).
- Un bonus couvre `BONUS_FLOORS = 5` poses réussies ; il s'applique dès l'étage qui apparaît au tick du déclenchement. La 5e pose y met fin ; l'étage suivant est normal.
- `ralenti` : vitesse d'un étage apparu pendant le bonus = `max(1, floor(v·3/5))`, `v` = vitesse v1. Le tirage est consommé comme d'habitude.
- `double` : points de la pose × 2.
- Pas de cumul : pendant un bonus la jauge ne se remplit pas. Comptage en poses : pause et cadence d'affichage sans effet.

## Points et hauteur
Points d'une pose : `(parfait ? 2 : 1) × (double ? 2 : 1)`. `score` = somme des points, `height` = étages posés. En v2, `score ≠ étages`.

## Reprise
- Premier raté (`continues = 0`) → état `fallen` : `step()` n'avance pas le tick, ignore les appuis ; le temps de décision n'existe pas pour les règles.
- `continueRun()` (autorisation venant de l'application, jamais du moteur) : `continueTicks = [t]` (t = tick du raté), base/score/hauteur conservés, même étage réapparu à sa position de départ avec la largeur de la base et sa vitesse v1 (sans nouveau tirage), bonus et jauge remis à 0, alternance conservée. Renvoie `false` sans effet hors `fallen` (double appel).
- Compte à rebours `COUNTDOWN_TICKS = 360` : ticks `]t, t+360[` immobiles, appuis ignorés ; au tick `t+360` événement `resumed` (encore immobile) ; le bloc bouge à `t+361`.
- `finish()` : fin sans reprise. Un second raté termine toujours.

## Rejeu v2
`{ seed, rulesVersion: 2, inputTicks, continueTicks? }`. En plus des règles v1 : `continueTicks` absent ou tableau d'au plus 1 entier ≥ 1, égal au tick du premier raté (`bad_continue_ticks`) ; aucune entrée dans `]t, t+360]` (`input_during_countdown`) ; `continueTicks` refusé en v1. `verifyRunResult` compare score, hauteur, parfaits, meilleure série, nombre de bonus, reprises et durée (égalité intégrale, revue Codex F6). `durationTicks` exclut l'attente de décision et inclut le compte à rebours.

Golden : `tests/game/golden-v2.json` (changer une valeur exige rulesVersion 3).
