# Claude Code Alexis

## Tâches

| Tâche | État | Branche | SHA / PR | Tests |
|---|---|---|---|---|
| Revue C0 (Codex) | Livrée : CHANGES_REQUESTED | agent/claude-code-alexis/a0-shell | revue du SHA `c79f5c8` → coordination/reviews/C0-claude-code-alexis.md | lecture + calculs, voir rapport |
| A0 squelette | REVIEW_PENDING (revue FLK) | agent/claude-code-alexis/a0-shell | [PR #2](https://github.com/alexis97432/jeuiaflouze/pull/2) | typecheck, 17 tests unitaires, 4 e2e (+2 ignorés par projet) verts |
| A1 intégration | En attente | — | — | dépend de F1 (FLK) |

## Commandes communes (pour FLK et Codex)

`npm ci` · `npm run typecheck` · `npm test` (Vitest, `tests/**/*.test.ts`, environnement node par défaut ; `// @vitest-environment jsdom` pour le DOM) · `npm run build` · `npm run test:e2e` (Playwright, bundle de production, Chromium desktop + Pixel 7). Node ≥ 22.12 (`.nvmrc`).
FLK : tes tests vont dans `tests/game/*.test.ts` et tournent sans configuration supplémentaire. Si tu as besoin d'une dépendance, propose-la dans ta PR : j'ajoute au `package.json`.
Note : sur Node 22 / npm 10.9.x, `npm install <paquet>` plante (bug arborist « edgesOut ») ; `npm ci` fonctionne. Pour ajouter un paquet : `npx npm@11.6.2 install -D --save-exact <paquet>`.

## Avis indépendant sur le concept (≤ 15 lignes)

- **Principale faiblesse :** le genre « empiler des blocs » est saturé et la mécanique est entièrement d'adresse ; le « même défi entre amis » change peu de chose quand la seed ne fait varier que la vitesse. Le différenciateur risque d'être invisible pour un joueur.
- **Concurrent de concept :** un **défi quotidien unique** (une seed par jour UTC pour tout le monde, une seule tentative classée, résultat partageable sous forme de carte sans spoiler). Le partage y est naturel (tout le monde joue la même chose aujourd'hui) et le retour J1 est structurel.
- **Recommandation :** garder la mécanique PILE OU CRASH (coût bas, contrat prêt) mais tester tôt le **mode quotidien** comme habillage plutôt qu'un autre jeu : il réutilise moteur, seed et URL.
- **Test pour départager :** au test des 10 personnes, deux ordres contrebalancés (libre puis quotidien / quotidien puis libre), mesurer rejouabilité spontanée en libre vs intention déclarée de revenir demain et de partager le quotidien. Puis à l'essai public : même cohorte, J1 comparé entre joueurs arrivés par lien quotidien et par lien libre. Hypothèse, pas une prédiction.

## Prochain pas

1. Revue FLK de la PR A0.
2. Arbitrage Codex sur B1–B4 de la revue C0 (notamment `onEvent`, `prefs`, collecteur de mesures avant M2).
3. A1 dès que la PR F1 a un PASS Codex : remplacer `src/app/game-loader.ts` par le vrai `mountGame`, retirer le mock du parcours.

## Blocages

- Revue de mon voisin **Codex** : faite (C0). Aucune autre livraison Codex disponible.
- FLK a ouvert [PR #1](https://github.com/alexis97432/jeuiaflouze/pull/1) F0 (SHA `3725541`). Sa revue revient à **Codex**, pas à moi ; je ne l'intégrerai qu'après PASS Codex sur son dernier SHA.
- **Contrôle de compatibilité (pas une revue)** : fusion d'essai A0 `de36153` + F0 `3725541` sans conflit ; `npm run typecheck` OK en mode strict ; `npx vitest run` → 6 fichiers, 94/94 tests verts. Les tests `tests/game/` de FLK tournent donc tels quels avec le scaffold A0.
- A1 dépend de F1 (rendu + `mountGame`), pas encore livré.
