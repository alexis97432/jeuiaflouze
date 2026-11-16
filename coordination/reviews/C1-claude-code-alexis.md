# Revue C1 (rapports F0/F1) — Claude Code Alexis

- **Tâche :** C1, livraison des revues F0 et F1, [alexis97432/jeuiaflouze#4](https://github.com/alexis97432/jeuiaflouze/pull/4)
- **Auteur :** Codex · **Reviewer :** claude-code-alexis
- **SHA revu :** `f18e5d49810990f223fc4e7627c791e16fbeffce` (tête de `agent/codex/c1-review-f0`)
- **Périmètre lu intégralement :** coordination/reviews/F0-codex.md, coordination/reviews/F1-codex.md, diff de coordination/status/codex.md depuis `c79f5c8`.
- **Méthode :** je n'ai pas relu le code FLK pour re-réviser F0/F1 à la place de Codex. J'ai vérifié que **chaque affirmation vérifiable des rapports est vraie sur le SHA cité**, dans des worktrees jetables (A0 `e84647e` + SHA FLK), avec les dépendances du lockfile A0 (Node 22.23.4).

## Vérifications

| Affirmation de Codex | Commande réelle | Résultat |
|---|---|---|
| F0 : A0 + F0 typecheck et tests verts (94/94) | fusion d'essai `e84647e` + `3725541`, `npm run typecheck`, `npx vitest run` | exit 0, 6 fichiers, 94/94 (déjà constaté lors de mon contrôle de compatibilité A0) |
| F0 : core compilable sans DOM | `tsc -p` d'une config temporaire `lib: [ES2022]`, `types: []`, strict, sur `src/game/core` (identique à `3725541`, vérifié par `git diff --quiet`) | exit 0 |
| F1 R2 : import `esbuild` absent des dépendances A0, puis `__dirname` en ESM | lecture de `tests/game/browser/build-harness.ts` lignes 1 et 8 sur `0896195`, `tsc` | ligne 1 `import { build } from 'esbuild'` ; ligne 8 `const here = __dirname;` ; 1 erreur TS2307 |
| F1 R1 : pose fantôme après une image gelée | test Vitest de la reproduction Codex, recopié tel quel, sur `0896195` | **échec reproduit** : `expected +0 to be 1` |
| F1 : 114 tests livrés verts | `npx vitest run` sur A0 + `0896195` | conforme (114 tests, hors mon test R1) |

Information complémentaire, sans valeur de revue F1 : la même reproduction R1 échoue encore sur `72a2aa9` et **passe sur `6974c51`** (tête actuelle de la PR #3, 120/120 tests avec A0). La re-revue de ce SHA revient à Codex.

## Défauts

Aucun bloquant.

- **m1 — mineur (F0-codex.md, § Limites, dernière phrase).** « Alexis peut intégrer F0 après vérification que #1 pointe toujours sur ce SHA » : vrai, mais la branche d'intégration ne contient pas encore A0 (`package.json`, CI). F0 seul y serait du code non exécutable par les commandes communes, jusqu'à la fusion d'A0. Je propose l'ordre A0 (#2, fusion par FLK après son PASS) puis F0 (#1), pour que la CI de l'intégration tourne dès l'arrivée du moteur. À noter dans PLAN ou AUTONOMIE.
- **m2 — mineur (status/codex.md).** « SHA exact à prendre dans la PR de livraison » : la PR #4 existe, mais la fiche gagnerait à citer `f18e5d4` directement, comme le demande AGENTS pour les rapports.
- **m3 — information (F1-codex.md, § R2).** La correction proposée (« réutilisation du bundler déjà présent ») est celle que FLK a retenue dans `72a2aa9` (harnais via Vite). En tant que propriétaire du `package.json`, je confirme qu'aucune dépendance supplémentaire n'est nécessaire.

## Arbitrages relevés (pas des défauts)

L'arbitrage des précisions F0 (entiers milli, plafond avant modulation, étage 1 avec tirage initial, départ impair gauche / pair droit, surplus réfléchi, premier appui au tick 1, contact = raté, tolérance incluse) répond à mes points M1 à M7 de la revue C0. **Ma demande de revue C0 reste ouverte** : ces règles doivent encore être reportées dans `docs/CONTRACTS.md`, avec B1 à B4, sur un nouveau SHA C0 que je relirai.

## Verdict

**PASS** sur `f18e5d49810990f223fc4e7627c791e16fbeffce` : rapports exacts et reproductibles, verdicts cohérents avec les preuves, limites honnêtement déclarées (pas de téléphone réel, tests navigateur F1 non lancés). Ce PASS porte sur les rapports, pas sur F1.
