# Claude Code FLK

## État au 16 novembre 2026, fin de session

| Tâche | État | Référence |
|---|---|---|
| F0 moteur pur | **Intégré** (`bcf6f79`) | PR #1, PASS Codex sur `3725541` |
| F1 rendu/entrée/boucle | **Intégré** (`650fe5d`) | PR #3, PASS Codex sur `b44d2a6` |
| Revue A0 | PASS, A0 intégré par FLK (`3c5ecf8`) avec l'accord de l'utilisateur | `coordination/reviews/A0-claude-code-flk.md` |
| Revue A1 | **PASS sur `7df764d`** (vrai moteur) | `coordination/reviews/A1-claude-code-flk.md`, PR #8 |

Vérification de l'intégration `650fe5d` depuis `npm ci` : typecheck exit 0, `npm test` 128/128, build exit 0, tests navigateur F1 13/13.

**Dépendances ouvertes :**
- A1 → **Alexis** : intégrer la PR #6 (`7df764d`, PASS FLK, CI verte), puis ce rapport (PR #8). Corriger m1 (`run_start` avant un montage raté) avant A1.5.
- M1 → **humains** : tests sur téléphones physiques iOS/Android, puis le premier playtest de compréhension (VALIDATION). Aucune session d'IA ne remplace cette étape.
- F2 → aucun travail avant le jalon M2 et une interface serveur convenue avec Alexis (A2). `replayRun` est prêt à être réutilisé tel quel.

---

## Historique détaillé

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

## F1 — rendu Canvas, entrée, boucle

- Revue Codex sur `0896195` : **CHANGES_REQUESTED** ([rapport](https://github.com/alexis97432/jeuiaflouze/blob/agent/codex/c1-review-f0/coordination/reviews/F1-codex.md)). Corrections :
  - **R1 (vrai bogue, merci)** : un appui mémorisé pendant une image gelée restait dans l'ancienne échelle de temps, d'où une pose fantôme plus tard. Désormais, le temps abandonné est aussi retiré des appuis en attente : ordre et écarts conservés, bornés au premier tick non simulé, fusion par tick. Cinq tests de régression : la reproduction exacte de Codex, plusieurs gestes dans un gel, un geste en début de gel, un geste livré après le gel avec un horodatage ancien, et plusieurs gels successifs. Quatre échouaient avant la correction.
  - **R2** : déjà corrigé dans `72a2aa9`, poussé juste après la revue. Le harnais est construit par Vite (A0), sans esbuild, et son chemin vient de `config.configFile`, sans `__dirname`. Vérifié depuis `npm ci` du lockfile A0 (voir ci-dessous).
  - Exécution en CI, **partiellement fermée dans mes chemins** : `tests/game/mount.dom.test.ts` (jsdom, déjà inclus par `npm test` donc par la CI d'A0) couvre les frontières F1 en 9 tests :
    - un toucher = une pose, `preventDefault`, clic droit ignoré ;
    - espace bloqué au keydown et au keyup, répétition, champ éditable ;
    - partie complète avec `onEvent` ordonné, `onEnd` unique après `END_DELAY_MS`, rejeu valide, espace rendu au DOM ;
    - pause et reprise sans rattrapage, onglet caché ;
    - destroy sans fuite, `onEnd` qui détruit, exception dans `onEvent`, échecs de montage.

    Quatre mutations (detach oublié, keyup non bloqué, reprise onglet caché, `onEnd` multiple) font échouer `npm test`. Les specs Playwright restent la preuve en vrai navigateur (DPR, toucher réel, audio).
  - Les specs Playwright, elles, ne sont pas lancées par la CI : la config Playwright racine et `package.json` appartiennent à Alexis. **Proposition à Alexis** : script `"test:game-browser": "playwright test -c tests/game/browser/playwright.config.ts --trace off"` et une étape CI après `test:e2e` ; ou un projet ajouté à la config racine avec `testDir: 'tests/game/browser'` et le `globalSetup` du harnais.
  - `onEvent` reste une **proposition optionnelle** (Codex rappelle qu'aucun changement unilatéral d'API n'est permis). Aucun consommateur ne l'utilise ; je le retire si Codex le refuse.
- État : **REVIEW_PENDING** (nouvelle revue Codex demandée sur le dernier SHA de la PR #3).
- Vérification du dernier SHA sur la fusion d'essai avec A0 `e84647e` (`npm ci` propre) : `npm run typecheck` exit 0, `npm test` **128/128**. Branche `agent/claude-code-flk/f1-render`, construite sur F0 (`3725541`), qui n'est pas encore revu ni intégré. La PR F1 contient donc aussi le commit F0 ; seul le diff après `3725541` est propre à F1.
- Compatibilité A0 vérifiée sur une fusion d'essai avec `e84647e` : TypeScript 7.0.2 strict + `noUnused*` OK, vitest 4.1.12 114/114, mes specs navigateur sous Vite 8.3.5 / ESM OK. Le harnais n'utilise plus esbuild : dépendance inutile, Vite d'A0 suffit.
- Fichiers : `src/game/index.ts` (API publique), `src/game/input/` (fixed-step.ts, input.ts), `src/game/render/` (mount.ts, renderer.ts, audio.ts, README.md), `src/game/demo/` (démo intégrable), `tests/game/fixed-step.test.ts`, `tests/game/browser/` (harnais + specs Playwright + config locale).
- Contrôles réels, le 16 novembre 2026, avec un outillage temporaire hors dépôt (Node 22.23.4, vitest 3.2.4, typescript 5.9.3, esbuild 0.25.10, @playwright/test 1.63.0 sur le Chromium préinstallé) :
  - `vitest run tests/game` → **97 tests passés** (77 F0 + 20 pas fixe) ;
  - `playwright test -c tests/game/browser/playwright.config.ts` → **13 tests passés** (dont `onEvent` et l'échec Canvas 2D sans fuite, ajoutés après la revue C0) dans Chromium headless : DPR 2 et 3 + redimensionnement, toucher = une pose, clic droit ignoré, espace face à un bouton focalisé, répétition, partie complète avec `onEnd` unique et rejeu vérifié, 20 poses avec effets bornés, pause/reprise sans saut, onglet caché, 25 montages/destructions sans écouteur ni RAF restant, audio fermé, `sound:false`, config invalide, reduced-motion ;
  - `tsc --noEmit` strict sur tout `src/game` + tests → OK ; core toujours compilable sans DOM ;
  - mutations : écouter aussi `mousedown` → 2 échecs ; oublier `detach()` → 1 échec ; ne plus bloquer espace → 1 échec. Ne bloquer que keydown passe, ce qui est attendu : le blocage du keyup est une double sécurité ;
  - bogue réel trouvé et corrigé grâce au test de cadence : un appui pile sur l'instant d'un tick glissait d'un tick à 60 Hz (epsilon d'arrondi asymétrique). Le temps est maintenant converti par une ancre exacte, la même fonction servant à `press` et `advance` ;
  - mesures, pas des FPS d'appareil : `draw()` médiane 0,2 ms, p95 0,3 ms sur 605 images (Chromium headless, conteneur cloud) ; `src/game` minifié ≈ 6,2 Ko gzip (esbuild).
- Vérification visuelle : captures 390×844 d'une série de parfaits, de coupes et d'un raté, examinées par moi. Ce n'est pas un avis humain.
- Manque : aucun test sur un vrai téléphone, ni Safari/WebKit ou Firefox, ni écoute réelle du son (aucun haut-parleur ici). Jeu non playtesté par un humain.

## Revue du voisin (FLK vérifie Alexis)

- A0 ([alexis97432/jeuiaflouze#2](https://github.com/alexis97432/jeuiaflouze/pull/2)) : **PASS** sur `e84647e0a5b1acca0e724977eecddaa8d113a417`. Rapport : [coordination/reviews/A0-claude-code-flk.md](../reviews/A0-claude-code-flk.md).
  - Les 5 commandes communes ont été relancées sur un worktree du SHA, et 2 mutations vérifiées.
  - Fusion d'essai avec F1 : sans conflit, 114/114 tests.
  - Aucun bloquant. Mineurs m2 à m5, et **m1 à corriger en A1** : l'e2e tactile vise un canvas détaché quand `onEnd` est asynchrone (timeout mesuré avec le vrai moteur).
- A1 : pas encore livré (dépend de F1). Revue à faire dès livraison.

## Réponse à la revue C0 d'Alexis (points adressés à FLK)

- M1 à M7 sont tranchés dans [src/game/core/README.md](../../src/game/core/README.md), dans le sens proposé par Alexis :
  - plafond avant modulation ;
  - un tirage pour l'étage 1, numéroté à partir de 1 ;
  - départ : s'éloigner du bord de départ ;
  - rebond réfléchi ;
  - premier tick d'appui = 1 ;
  - entiers en millièmes et vitesse entière en milli/tick ;
  - parfait `≤ 4000`, raté `≤ 0`.
- M8 : `replayRun` borne déjà la durée (`maxTicks`) et le nombre d'entrées (`maxInputs`), avec des limites resserrables côté serveur. Une limite d'inactivité par étage reste à décider par Codex avant tout classement.
- B1 : `onEvent?` ajouté dans F1 (optionnel).
- B2 : `sound?` et `reducedMotion?` à la création. `setPrefs` à chaud : je peux l'ajouter si Codex l'accepte.
- B3 : erreur synchrone sans effet de bord, testée dans Chromium.
- Ces ajouts restent des propositions : je n'ai pas modifié `docs/CONTRACTS.md`.

## Avis indépendant sur le concept (demandé pour M0)

1. Faiblesse principale : le jeu d'empilement à un geste est un genre très exploré. La règle ne différencie rien, la sensation de pose (son, rythme des parfaits, lisibilité) porte tout. Un rendu moyen donnera probablement un clone de plus.
2. Le « défi sur la même séquence » est peu perceptible : la seed ne module que ±10 % de vitesse. Deux amis vivent presque la même partie qu'en mode libre, donc le défi se réduit à un score cible. Ce n'est pas un défaut technique, mais l'argument « même séquence » est faible tel quel.
3. Risque de rythme : les parfaits gardent la largeur et la vitesse plafonne. Un joueur précis peut faire des parties longues et monotones. À mesurer en playtest : durée médiane, étage du premier raté.
4. Concept concurrent à tester : « la tour du jour ». Une seed quotidienne UTC commune, trois essais, et une carte de résultat sans spoiler (une ligne de symboles par pose : parfait, coupe faible, coupe forte). Même moteur, sans backend en M1. La carte donne une raison de partager que le score seul n'offre pas.
5. Test pour départager : dans le playtest de 10 personnes de VALIDATION.md, alterner deux écrans de résultat (défi ami / tour du jour) et noter le rejeu spontané et l'intention déclarée de partager, plus les verbatims. Signal qualitatif uniquement, non extrapolable.
6. Recommandation : garder le prototype actuel (il est compatible), concentrer F1 sur la sensation de pose, et préparer la tour du jour comme variante d'écran de résultat, pas comme second moteur. Si l'on veut que la seed se voie, il faudrait une variation perceptible (par exemple vitesse par motifs), donc rulesVersion 2 et une décision Codex.

## Coordination (PR #5, protocole d'autonomie)

Lu sur `df88ba5`. Sa revue revient à Alexis ; je n'ai rien à objecter côté FLK. J'applique la veille bornée : 60 s, 15 min au plus.

**Dépendances ouvertes :**
- F1 → **Codex** : revoir la PR #3 au dernier SHA (rapport `coordination/reviews/F1-codex.md` à mettre à jour) ; décider si `onEvent`, `setPrefs` et le masquage du voile de pause du canvas sont acceptés.
- F0 → **Alexis** : intégrer la PR #1 (`3725541`, PASS Codex) après vérification du SHA.
- Revue A1 → **Alexis** : livrer A1 (PR + SHA) ; je la revois dès qu'elle est disponible, sans toucher à ses fichiers.
- CI navigateur F1 → **Alexis** : script `test:game-browser` et étape CI, si accepté.

## Prochain pas

- Attendre les revues Codex de F0 et F1 et corriger les éventuels bloquants sur un nouveau SHA.
- Revoir A0 puis A1 dès qu'ils seront livrés : vraies entrées/sorties, URL, stockage, partage, accessibilité, commandes CI.
- Proposer à Alexis de reprendre mes specs navigateur dans `npm run test:e2e`, ou de garder ma config locale.
- F2 seulement après le jalon M2 et une interface serveur convenue. `replayRun` est déjà prévu pour être réutilisé tel quel, sans second algorithme de score.
- Aucune dépendance supplémentaire pour F1 : Vite, Vitest, TypeScript et @playwright/test d'A0 suffisent.
