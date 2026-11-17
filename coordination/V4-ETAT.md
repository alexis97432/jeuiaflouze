# V4 — état de reprise (Claude Code Alexis)

Fichier de reprise : si une session s'interrompt, repartir d'ici. Mis à jour à chaque étape.

## Cadre exceptionnel V4 (consigne utilisateur du 17 novembre 2026)

- Alexis travaille **seul** : FLK et Codex ne participent pas à la V4.
- Pour la V4 uniquement, l'utilisateur autorise :
  - les modifications dans tous les périmètres, moteur `src/game` compris ;
  - l'absence de revue externe ;
  - la fusion de ses propres PR ;
  - la publication Pages après vérification.
- Les vérifications V4 sont une **auto-vérification**, pas une revue indépendante. Cela doit être écrit partout où un résultat est rapporté.
- Précautions conservées :
  - pas de force-push ;
  - pas de suppression de sauvegardes ni d'écrasement du travail existant ;
  - pas de secret ;
  - pas de dépense, de compte ni d'abonnement payant ;
  - pas de faux succès publicitaire ou de paiement ;
  - règles de jeu déterministes inchangées (rejeux v1 et v2 identiques).
- Branche : `agent/claude-code-alexis/v4-interface`, partie de `02037e8` (= version en ligne avant la V4).

## Décisions de conception

- **Direction visuelle « bonbons arcade »** :
  - police arrondie Fredoka, embarquée via `@fontsource-variable/fredoka` 5.3.0, licence OFL-1.1 ;
  - icônes SVG cohérentes Lucide 1.66.0, licence ISC, dessinées avec le `document` du shell ;
  - jetons de couleur en clair et en sombre ;
  - boutons « 3D » qui s'enfoncent ;
  - animations courtes, coupées si les animations sont réduites.
- **Accueil** :
  - barre du haut : niveau, pièces, vies, Aide, Réglages ;
  - un très grand bouton Jouer, puis une carte Défi du jour ;
  - en bas, un dock à quatre entrées : Boutique, Collection, Récompenses, Classement.
- **Vocabulaire enfant**, au tutoiement partout :
  - « Défi du jour » (et non plus « Tour du jour ») ;
  - « Missions » à la place des « Défis à réussir », pour ne pas confondre avec les deux autres défis ;
  - pas de « UTC », de « non vérifié », de date ISO ni de « serveur » dans les parcours joueurs.
- **Fenêtres** : feuilles modales accessibles. Fermeture par Échap, le bouton ✕ ou le fond, sauf l'offre de reprise, qui garde « Terminer ». Le focus est piégé dans la fenêtre puis rendu à l'élément d'origine.
- **Réglages** (`poc:v1:prefs`, rétrocompatibles avec `{ muted }`) :
  - thème : Auto, Clair ou Sombre ;
  - son : coupé ou activé, plus un volume ;
  - vibrations, seulement si `navigator.vibrate` existe, sinon une mention « non disponibles » ;
  - animations : Auto (selon l'appareil), Réduites ou Normales ;
  - effets visuels : Complets ou Fluides (résolution plafonnée, moins de particules et de décor) ;
  - « Comment jouer ».
- **Partie** :
  - bouton Pause (Reprendre ou Quitter ; une partie quittée n'est pas comptée) ;
  - retours haptiques ;
  - qualité d'effets et volume transmis au moteur ;
  - police du canvas alignée sur l'interface ;
  - textes du canvas au tutoiement.
- **Résultat** : carte de célébration (record, gains, niveau), compteur animé si les animations sont autorisées, confettis légers (coupés en animations réduites ou en mode Fluide).

## Étapes

| # | Étape | État |
|---|---|---|
| S0 | Audit et inventaire (`docs/V4-AUDIT.md`), captures « avant » (`coordination/captures/v4-avant/`) | fait |
| S1 | Préférences v2 : thème, mouvement, effets, son et volume, vibrations (`src/platform/storage.ts`, `src/app/prefs.ts`, `src/app/feedback.ts`) | fait (tests à écrire en S6) |
| S2 | Système visuel : jetons clair/sombre, composants, police, icônes (`src/styles/`, `src/app/ui/icons.ts`) | fait |
| S3 | Composants d'interface : feuille modale, barre du haut, dock, segments, interrupteur, curseur (`src/app/ui/components.ts`) | fait |
| S4 | Écrans : accueil, récompenses, passe, boutique, collection, classement, réglages, aide, résultat, partie et pause, reprise (`src/app/shell.ts`, `src/app/collection-view.ts`) | fait, typecheck propre |
| S5 | Moteur : qualité d'effets, volume, police (`src/game/render/`) | fait |
| S6 | Tests : mise à jour, régressions, exploration de tous les boutons, contrastes, thèmes, petits écrans | fait (501 unitaires, 92 e2e, 39 moteur ; exploration 36 boutons ; contrastes clair/sombre) |
| S7 | Documentation, statut, PR, fusion, publication Pages, vérification en ligne | en cours (documentation faite : `docs/V4.md`, `docs/LICENCES-TIERS.md`) |

## Reprise

- **Dernier état local, vérifié après `npm ci` (npm 10) :**
  - `npm run typecheck` : OK ;
  - `npm test` : 501 tests ;
  - `npm run build` : OK ;
  - `CI=1 npm run test:e2e` : 92 tests passés, 46 ignorés par conception (profils), plus 39 tests moteur.
- **Verrou corrigé :** l'installation de la police et des icônes avec npm 11 avait retiré `@emnapi/core` et `@emnapi/runtime` du `package-lock.json`, et `npm ci` (npm 10, CI) échouait. Les deux entrées sont restaurées depuis la V3.
- **Prochaine action :**
  1. contrôle par mutation des nouveaux tests (contraste, exploration des boutons, délai de garde) ;
  2. PR vers `claude/youthful-mayer-n4f7oy`, avec l'exception documentée ;
  3. CI ;
  4. fusion ;
  5. `pages.yml` avec le SHA exact ;
  6. vérification en ligne (`source-commit.txt`, ressources, parcours).
