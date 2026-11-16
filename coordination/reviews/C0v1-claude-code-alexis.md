# Revue du contrat corrigé C0 (v1) et de la nouvelle revue F1 — Claude Code Alexis

- **Tâche :** C0 corrigé, [alexis97432/jeuiaflouze#7](https://github.com/alexis97432/jeuiaflouze/pull/7)
- **Auteur :** Codex · **Reviewer :** claude-code-alexis
- **SHA revu :** `3fdccac75bf34d1874657e6b854025850cd9f306` (tête de `agent/codex/c0-contracts-f1-review`, base intégration `ad50b4a`)
- **Périmètre lu intégralement :** diff `ad50b4a...3fdccac` de docs/CONTRACTS.md, docs/VALIDATION.md, coordination/PLAN.md, coordination/AUTONOMIE.md, coordination/status/codex.md et coordination/reviews/F1-codex.md (nouvelle revue).
- **Confrontation au code réel :**
  - `src/game/core/README.md` de F0 `3725541` : plafond avant modulation, étage impair à gauche / pair à droite, surplus réfléchi, premier appui au tick 1, contact = raté avant parfait, tolérance ≤ 4000 milli incluse ;
  - `src/game/index.ts`, `render/mount.ts` et `render/renderer.ts` de F1 `b44d2a6` : `GameEvent`, `onEvent`, `sound`, `reducedMotion`, `RangeError` et `Error('Canvas 2D indisponible')` levées avant tout attachement, `destroy` idempotent, `END_DELAY_MS` exporté.

  Tout ce que CONTRACTS v1 affirme de ces fichiers est exact.
- **Consommation réelle :** le contrat v1 est appliqué tel quel dans A1 (bascule sur le vrai `mountGame`, PR #6). Le typecheck contre `src/game/index.ts` passe sans copie locale des types.

## Réponse à mes demandes C0

| Demande | Statut |
|---|---|
| B1 `onEvent` / `first_placement` | Accepté ; first_placement = première pose réussie, une fois. Implémenté ainsi en A1. |
| B2 préférences | `sound` et `reducedMotion` à la création, son changé entre les parties. Conforme au shell : le réglage n'est proposé qu'à l'accueil, jamais pendant une partie. |
| B3 échec de montage | Erreur synchrone documentée ; le shell l'attrape et propose de réessayer (testé). |
| B4 mesure avant M2 | Tâche A1.5 créée, sans bloquer M1. |
| M1–M7 simulation | Renvoi normatif à core/README, vérifié ci-dessus. |
| M8 durée non bornée | Reporté avant A2 et explicité. |
| m1/m2 URL | `v` = rulesVersion, décimal canonique : déjà conforme à `src/app/challenge-url.ts`. |
| m4 horodatage relatif | Accepté. |
| S1 règle statistique | Règle de Wilson fixée à l'avance, une seule prolongation jusqu'à 400, cas inconclusif explicite. Correct. |
| S2 attribution | Reconnu comme non prouvable par `src=share` seul. Pas de paramètre ajouté à l'URL : je n'ajoute rien en A1. |

## Défauts

Aucun bloquant.

- **m1 — mineur (CONTRACTS § Simulation).** La référence normative `src/game/core/README.md` n'existe pas encore sur la branche d'intégration : elle arrive avec F0 (#1). Avant cette fusion, un lecteur de l'intégration ne trouve pas la règle. Suggestion : citer « F0 #1, `3725541` » à côté du chemin. C'est d'ailleurs déjà le cas, donc le défaut se résout de lui-même à la fusion de F0.
- **m2 — mineur (CONTRACTS, bloc API).** Le texte mentionne `END_DELAY_MS` « exporté » et les exports `replayRun` / `verifyRunResult`, mais le bloc de code ne les liste pas. Le bloc devrait refléter `src/game/index.ts` tel qu'il est.
- **m3 — mineur, non traité (CONTRACTS § Shell, pause cachée).** Le contrat demande au shell d'appeler `pause` à l'onglet caché, alors que F1 se met aussi en pause et dessine son propre voile. Deux messages se superposent (point i1 de la revue A0 de FLK). Je le règle **sans changer l'API** : le voile DOM du shell est maintenant opaque et masque le texte du canvas. À confirmer par FLK dans sa revue A1.
- **m4 — information.** `src/game/index.ts` n'exporte pas `RULES_VERSION`. Le shell garde sa constante `1`, liée par le type `RunConfig['rulesVersion']` : toute divergence casse le typecheck.

## Verdict

**PASS** sur `3fdccac75bf34d1874657e6b854025850cd9f306`. Le contrat v1 peut être considéré comme figé pour M1. Les mineurs m1 à m3 viendront dans une PR Codex ultérieure.
