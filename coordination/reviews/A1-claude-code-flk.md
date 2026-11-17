# Revue A1 (bascule vers le vrai moteur) — Claude Code FLK

- **Tâche :** A1, intégration réelle, [alexis97432/jeuiaflouze#6](https://github.com/alexis97432/jeuiaflouze/pull/6)
- **Auteur :** claude-code-alexis · **Reviewer :** claude-code-flk
- **SHA revu :** `7df764d60ca1876d214cb3a717651f5b9b737768`, sur un worktree détaché de ce SHA.
- **Périmètre lu :**
  - diff `723b184..7df764d` hors `src/game/` et `tests/game/` : `game-contract.ts`, `game-loader.ts` (adaptateur `createStartGame`), `shell.ts` (retrait du mock), `styles.css` (voile opaque), `main.ts`, `package.json` (`test:game-browser`) ;
  - `tests/app/game-loader.test.ts`, `tests/e2e/{a1,shell}.spec.ts`, `tests/e2e/helpers.ts` ;
  - description de la PR.
- **Mes chemins sont intacts :** `git diff b44d2a6 7df764d -- src/game tests/game` est vide. F1 est intégré par le merge `9b66e28`, qui conserve les SHA `b44d2a6` (PASS Codex) et `3725541` (PASS Codex).

## Commandes et résultats réels (16 novembre 2026, Node 22.23.4, `npm ci` propre)

| Commande | Résultat |
|---|---|
| `npm ci` | 0 vulnérabilité |
| `npm run typecheck` (deux configs) | exit 0 |
| `npm test` | 11 fichiers, 184/184 |
| `npm run build` | JS 9,98 Ko gzip, CSS 0,94 Ko gzip ; `grep "__metrics\|mock" dist/assets/*.js` → 0 |
| `CI=1 npm run test:e2e` | e2e A1 : 25 réussis, 14 ignorés par profil ; puis `test:game-browser` : **13/13** ; exit 0 |
| CI GitHub, check `check` sur `7df764d` | **success** (run 43961530951) |

**Sondes supplémentaires sur l'application réelle** : un spec Playwright temporaire, profil desktop, jamais commité. 5/5 réussies.
- Son coupé à l'accueil, puis deux poses : **0** `AudioContext` créé.
- Son actif : 0 contexte avant le premier geste, **1 seul** après deux poses.
- Onglet caché en pleine partie : voile DOM visible, focus sur « Reprendre » au retour. Après la reprise : ni `first_placement` ni `run_end` sans geste de jeu, donc pas de pose fantôme.
- Onglet caché juste après des appuis rapides qui mènent au raté : le résultat arrive après « Reprendre », avec un seul `run_end`. Limite : je n'ai pas contrôlé que le masquage tombe exactement dans les 650 ms de l'animation de fin.
- Canvas 2D nul : message « Le jeu n'a pas pu démarrer » et bouton Réessayer. Les mesures valent alors `["session_start","run_start","run_start"]` : m1 est confirmé (voir ci-dessous).

## Remarques de la revue précédente

- **m1 — mineur, toujours ouvert (`src/app/shell.ts`, `retry`/`run_start` émis avant `startGame`).** Confirmé sur l'application réelle : chaque tentative de montage ratée ajoute un `run_start` sans partie. Cela gonfle les parties commencées dans les cohortes de VALIDATION. À corriger avant A1.5 (export des mesures), pas bloquant pour M1.
- **m2 — mineur, non vérifié sur appareil.** La copie de secours après l'échec de `share` reste à tester sur iOS réel.
- **m3 — corrigé.** `game-loader.ts` documente le contrat v1. L'adaptateur est pur et testé : `sound = !muted`, `reducedMotion` omis, `first_placement` seulement sur une pose réussie. Les deux mutations annoncées par Alexis sont plausibles d'après les assertions.
- **i1 — résolu et confirmé côté FLK.** Le voile DOM opaque masque le voile du moteur, sans changement d'API. Je n'ajoute donc pas d'option au moteur.

## Verdict

**PASS** sur `7df764d60ca1876d214cb3a717651f5b9b737768`. Le prototype M1 est complet pour le parcours local : vrai moteur, défi, record, partage, CI verte incluant les tests navigateur F1.

Ordre d'intégration (PLAN) : F0 #1, puis F1 #3, puis cette PR, en merges classiques. m1 doit être corrigé avant A1.5. Ce PASS ne couvre aucun SHA ultérieur, et ne remplace ni les tests sur téléphones physiques ni le playtest humain.

---

## Historique : revue de la préparation (avant la bascule)

### Revue A1 (préparation) — Claude Code FLK

- **Tâche :** A1, préparation avec moteur simulé, [alexis97432/jeuiaflouze#6](https://github.com/alexis97432/jeuiaflouze/pull/6) (brouillon)
- **Auteur :** claude-code-alexis · **Reviewer :** claude-code-flk
- **SHA revu :** `723b18400dc11c0cf36e6959d8c635d253e70a48`, sur un worktree détaché de ce SHA. Diff propre à A1 : `e84647e..723b184` (3 commits).
- **Périmètre lu intégralement :** package.json, tsconfig.json, tsconfig.node.json, playwright.config.ts, .github/workflows/ci.yml, src/main.ts, src/env.d.ts, src/app/{challenge-url,game-loader,mock-game,shell}.ts, src/platform/{storage,share}.ts, tests/e2e/shell.spec.ts (début), description de la PR. Les deux revues Codex incluses (C1, protocole) sont déjà intégrées et ne font pas l'objet de ce rapport.

## Commandes et résultats réels (16 novembre 2026, Node 22.23.4, `npm ci` propre)

| Commande | Résultat |
|---|---|
| `npm ci` | 88 paquets, 0 vulnérabilité |
| `npm run typecheck` (deux configs) | exit 0 |
| `npm test` | 7 fichiers, 75/75 |
| `npm run build` | JS 5,17 Ko gzip, CSS 0,98 Ko gzip ; `grep __metrics dist/assets/*.js` → 0 occurrence |
| `CI=1 npm run test:e2e` | 22 réussis, 14 ignorés par profil, exit 0 |

**Sondes supplémentaires**, ajoutées dans un fichier temporaire puis supprimé : 23/23.
- `parseChallenge` :
  - seed 2³²−1 acceptée, seed 2³² refusée ;
  - `v=01`, `seed=00`, `target=00`, `-0`, `+1`, `1e3`, `0x10`, valeur vide ou sans `=` : refusés ;
  - chiffre pleine chasse (`%EF%BC%91`), octet nul, 11 chiffres : refusés ;
  - paramètre répété et paramètre seul : `malformed` ;
  - casse différente (`V`, `SEED`) : traitée comme aucun défi ;
  - `%31` décodé en `1` et paramètres `utm_*` : acceptés ;
  - fragment `#…` ignoré.
- `buildChallengeUrl` : retire les autres paramètres et le fragment, borne `target` à 10000, et le lien obtenu se relit comme un défi.
- `createLocalStore` sur un stockage qui lève à chaque appel : record conservé en mémoire, `persistent = false`, une égalité n'est pas un record.

**Frontière réelle avec le moteur F1 validé** (`b44d2a6`, PASS Codex), dans un worktree jetable :
- fusion A1 + F1 sans conflit ;
- `game-loader.ts` branché à l'essai sur `mountGame`, avec `sound: !prefs.muted` et `onEvent` placement → `onFirstPlacement`.

Résultats :
- `npm run typecheck` exit 0 ;
- `npm test` : 11 fichiers, 186/186 ;
- `CI=1 playwright test --repeat-each 3` : **66 réussis, 42 ignorés par profil, 0 échec**, une fois retirée la seule assertion qui exige le bandeau mock (`tests/e2e/shell.spec.ts:15`). Ce retrait est attendu à la bascule.

Les corrections de mes remarques A0 sont vérifiées dans le code :
- m1 : appuis par coordonnées ou clavier global, attente du résultat puis de la garde ;
- m2 : `push` limité à l'intégration ;
- m3 : `retries: 0` ;
- m4 : `__metrics` absent du build de production ;
- m5 : `tsconfig.json` sans types Node pour `src/`.

## Défauts

Aucun défaut bloquant pour cette préparation.

**m1 — mineur (`src/app/shell.ts:232-240`).** `run_start` (et `retry`) est émis avant `startGame`. Si le montage lève (Canvas 2D indisponible, B3 du contrat v1), la mesure garde un `run_start` sans partie ni `run_end`, et chaque « Réessayer » en ajoute un. Cela gonfle les parties commencées dans les cohortes de VALIDATION. Correction suggérée : émettre `retry`/`run_start` après un montage réussi, ou un événement d'échec distinct.

**m2 — mineur, non vérifié sur appareil (`src/platform/share.ts:17-26`).** Après un échec de `navigator.share` autre qu'une annulation, la copie est tentée après un `await`. Certains navigateurs, dont Safari, exigent une activation utilisateur encore valide pour `clipboard.writeText`, qui peut alors échouer. Le repli manuel (lien affiché et sélectionné) reste correct, donc aucun blocage. À vérifier sur iOS réel avec la vague de tests sur téléphone.

**m3 — mineur, à la bascule (`src/app/game-loader.ts:3-9`).** Le commentaire indique que `sound`/`onEvent` ne sont pas figés et que F1 est en CHANGES_REQUESTED. Le contrat v1 (PR #7, en revue chez toi) les accepte, et F1 a un PASS sur `b44d2a6`. Mettre à jour à la bascule. Le branchement d'essai ci-dessus montre que l'adaptateur tient en une dizaine de lignes.

**i1 — décision commune encore ouverte.** À onglet caché, le voile DOM du shell (« Partie en pause / Reprendre ») couvre le voile dessiné par le moteur (« Pause »). Le shell écoute `visibilitychange` avant le moteur et appelle `pause()` ; le moteur reste alors en pause « shell » et n'affiche pas « Touchez pour reprendre ». Le comportement est correct et la reprise passe par ton bouton accessible. Seul reste un double libellé sous le voile semi-transparent. Je suis d'accord avec ta proposition : le voile DOM fait foi. Côté F1, je propose une option additive pour ne pas dessiner de voile, soumise à l'accord de Codex avant tout changement.

## Points solides

- Validation d'URL stricte et testée, conforme au contrat v1 : décimal canonique, doublons refusés, `v` = rulesVersion. Messages d'erreur sans HTML injecté.
- Stockage tolérant à tout échec, avec un miroir mémoire et une indication honnête « sauvegarde indisponible ».
- Partage :
  - `navigator.share` est appelé de façon synchrone dans le geste ;
  - une annulation n'est pas un succès et ne déclenche pas de copie silencieuse ;
  - le repli manuel est accessible.
- Le délai de garde de 500 ms corrige un vrai défaut trouvé contre le vrai moteur : un appui au moment du raté relançait la partie.
- Le défi rejoue la même seed, le score annoncé est marqué « non vérifié », et `first_placement` est émis une seule fois par partie.
- Les e2e mobiles couvrent un deuxième contexte de navigateur, l'injection, le stockage bloqué, corrompu ou plein, et le partage absent ou annulé.

## Verdict

**PASS** sur `723b18400dc11c0cf36e6959d8c635d253e70a48`, **pour la préparation A1 avec mock**. Ce n'est pas un PASS du jeu intégré. La bascule vers le vrai `mountGame` produira un nouveau SHA, qui exige une nouvelle revue FLK. À ce moment-là, je vérifierai aussi m1 à m3. Ce PASS ne couvre aucun SHA ultérieur.
