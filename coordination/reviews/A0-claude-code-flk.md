# Revue A0 — Claude Code FLK

- **Tâche :** A0 (squelette TypeScript/Vite, shell accessible, mesure locale, CI), [alexis97432/jeuiaflouze#2](https://github.com/alexis97432/jeuiaflouze/pull/2)
- **Auteur :** claude-code-alexis · **Reviewer :** claude-code-flk
- **SHA revu :** `e84647e0a5b1acca0e724977eecddaa8d113a417`, sur un worktree détaché de ce SHA (pas sur le résumé de la PR). La revue C0 incluse dans la branche n'est pas l'objet de ce rapport ; j'y réponds dans ma fiche de statut.
- **Périmètre lu intégralement :** package.json, package-lock (versions), tsconfig.json, vite.config.ts, playwright.config.ts, .gitignore, .nvmrc, .github/workflows/ci.yml, index.html, src/main.ts, src/env.d.ts, src/styles.css, src/app/{shell,game-contract,game-loader,mock-game}.ts, src/platform/{metrics,random}.ts, tests/e2e/shell.spec.ts, début de tests/app/shell.test.ts, fiche de statut Alexis.

## Commandes et résultats réels (16 novembre 2026, Node 22.23.4, conteneur cloud)

| Commande | Résultat |
|---|---|
| `npm ci` | OK, 0 vulnérabilité |
| `npm run typecheck` | exit 0 |
| `npm test` | 4 fichiers, 17/17 |
| `npm run build` | OK, JS 2,70 Ko gzip, CSS 0,85 Ko gzip |
| `CI=1 npm run test:e2e` | 4 réussis, 2 ignorés par projet, exit 0 |

**Mutations, que j'ai vérifiées moi-même :**
- suppression de la déduplication de `run_end` → `npm test` exit 1 ;
- suppression de `focus.focus()` dans `show()` → `npm test` exit 1.

Les commandes échouent donc bien sur un défaut réel.

**Recherche de dépendances interdites :** `fetch`, `localStorage`, `sessionStorage`, `sendBeacon`, `XMLHttpRequest`, `WebSocket`, `innerHTML` dans `src/app`, `src/platform` et `src/main.ts` → aucune utilisation, à part un commentaire « jamais innerHTML ».

**Frontière réelle avec mon moteur.** Fusion d'essai A0 `e84647e` + F1 (qui inclut F0), sans conflit, dans un worktree jetable :
- `npm run typecheck` (TypeScript 7.0.2, `noUnused*`) : seule erreur, mon import `esbuild` absent de vos dépendances. **Corrigé de mon côté** dans F1 : le harnais utilise Vite, et son chemin ne dépend plus de `__dirname` (incompatible avec `"type": "module"`). Après correction, typecheck exit 0.
- `npm test` (vitest 4.1.12) : 7 fichiers, 114/114 (vos 17 + mes 97).
- Mes 13 specs navigateur passent sous Vite 8.3.5 / ESM.
- Avec le vrai `mountGame` branché dans `game-loader.ts` (essai uniquement), le parcours clavier complet de votre e2e passe, séquence de métriques comprise, une fois retirée l'assertion « bandeau mock ». Le parcours tactile échoue : voir m1.

## Défauts

Aucun défaut bloquant pour A0.

**m1 — mineur pour A0, à corriger en A1 (`tests/e2e/shell.spec.ts:4-11`, utilisé l. 50).** `playUntilResult` touche le canvas en boucle via un locator et suppose que `onEnd` arrive dans le même geste, comme avec le mock. Le contrat n'impose pas ce synchronisme, et le vrai moteur appelle `onEnd` 650 ms après le raté pour montrer la chute. Le `tap` suivant vise alors un canvas que l'écran résultat détache, et Playwright attend 30 s : mesuré, timeout sur Pixel 7 avec le vrai moteur. J'ai vérifié par sonde que le canvas reste stable (380×676 CSS, 998×1773 px) pendant la partie : ce n'est pas un défaut du shell. Pistes :
- toucher par coordonnées (`page.touchscreen.tap(x, y)`), ce qui n'attend pas l'élément ;
- ou `canvas.tap({ timeout: 500 }).catch(() => {})` ;
- puis attendre le titre « Partie terminée » avec un délai > 650 ms.

Avec le vrai moteur, toucher juste après chaque apparition finit la partie en trois poses (score 2) : 10 tentatives suffisent.

**m2 — mineur (`.github/workflows/ci.yml:4-6`).** `push` sur `agent/**` plus `pull_request` lancent deux fois la CI pour chaque push d'une branche avec PR. Suggestion : `push` limité à la branche d'intégration.

**m3 — mineur (`playwright.config.ts:9`).** `retries: 1` en CI masque les tests instables, qui passent au second essai sans alerte. Suggestion : `failOnFlakyTests: true` (Playwright ≥ 1.52), ou garder 0 retry.

**m4 — mineur (`src/main.ts:30-31`).** `window.__metrics` est exposé aussi dans le build de production. C'est local et sans donnée personnelle, mais c'est un point d'accès de test dans le produit. Suggestion : le conditionner à `import.meta.env.DEV` ou à un drapeau de build e2e.

**m5 — mineur (`tsconfig.json:5`).** `types: ["vite/client", "node"]` s'applique aussi au code navigateur : `process` ou `Buffer` dans `src/app` passeraient le typecheck puis casseraient à l'exécution. Suggestion : un tsconfig séparé pour configs et tests, ou une règle qui interdit ces globals dans `src/`. Même idée pour `src/game/core`, que je garde compilable sans DOM.

**i1 — information pour A1 (pas un défaut d'A0).** À onglet caché, le shell met en pause et affiche son voile « Partie en pause / Reprendre ». Mon moteur se met aussi en pause et dessine « Touchez pour reprendre » dans le canvas, sous votre voile semi-transparent : deux textes superposés. Les deux pauses sont compatibles (`resume()` lève les deux ; testé dans F1). Il faut choisir un seul message en A1 : je peux masquer le texte du canvas si le shell gère la pause, ou vous pouvez vous appuyer sur celui du moteur.

## Points solides

- Le shell ne connaît pas les règles. `onEnd` est protégé contre les doublons, les parties périmées et les appels réentrants (microtâche).
- DOM construit sans `innerHTML`, focus déplacé à chaque écran, annonces `aria-live`, boutons de 48 px, focus visible, testé à 320 px.
- Le mock est explicite à l'écran et isolé dans `game-loader.ts`.
- Mesure strictement locale, champs communs du contrat, `run_end` dédupliqué, une erreur de puits ne casse pas le jeu.
- Versions exactes et lockfile ; la CI exécute bien les cinq commandes communes.

## Verdict

**PASS** sur `e84647e0a5b1acca0e724977eecddaa8d113a417`. Les mineurs m2 à m5 peuvent être faits en A0 ou en A1. **m1 devra être corrigé en A1** : c'est l'e2e qui doit prouver le parcours avec le vrai moteur. Ce PASS ne couvre pas un SHA ultérieur.
