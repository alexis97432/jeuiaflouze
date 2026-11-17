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
| S7 | Documentation, statut, PR, fusion, publication Pages, vérification en ligne | fait : PR #48 (`7c4c671`) et PR #49 (`a3f9484`) fusionnées, publiées et vérifiées en ligne |

## Publication V4 (auto-vérification)

1. **Contrôle par mutation :** trois défauts introduits volontairement, chacun détecté par le test attendu, puis fichiers restaurés :
   - « Crash » à 2,71:1 : tests de contraste ;
   - bouton d'aide sans effet : exploration des boutons ;
   - reprise sans délai de garde : test unitaire.
2. **PR [#48](https://github.com/alexis97432/jeuiaflouze/pull/48)**, head `86364e0` :
   - CI `check` en succès (run 44187066913) : `npm ci`, typecheck, 501 tests unitaires, 92 e2e (46 ignorés par conception), 39 tests moteur ;
   - fusionnée par son auteur (exception V4) en `7c4c671`.
3. **Pages :** `pages.yml` lancé avec `ref` = `7c4c671392b047705fcf182ba432093661b8b236`. Le run 44187918060 est en succès : il a rejoué les tests, publié, puis contrôlé `source-commit.txt` en ligne.
4. **Vérification du site en ligne,** faite depuis ce conteneur avec Chromium (profil Pixel 7). Le site sert `7c4c671` depuis 22 h 18 UTC. Les 23 contrôles passent :
   - `source-commit.txt` ;
   - `licences-tiers.txt` ;
   - police Fredoka chargée ;
   - accueil V4 ;
   - thème Auto, puis Sombre gardé après rechargement ;
   - retour du téléphone ;
   - Pause, puis Quitter sans rien enregistrer ;
   - offre de reprise et « Vidéo indisponible » désactivée ;
   - vie décomptée une seule fois, aussi après rechargement ;
   - résultat avec Rejouer, Défier un ami et Accueil ;
   - 320 × 568 sans débordement ;
   - toutes les ressources servies ;
   - aucune erreur console.

   Contrôles en ligne en plus : liens `?v=1` et `?v=2` acceptés, lien invalide signalé, thème sombre suivi depuis l'appareil.
5. **Suivi, PR [#49](https://github.com/alexis97432/jeuiaflouze/pull/49) :**
   - les messages de lien invalide ne disent plus « séquence invalide », « score invalide » ni « mal formé » ; un test le vérifie ;
   - head `44c4ed7`, CI en succès (run 44189144733) ;
   - fusionnée en `a3f9484`, publiée par le run Pages 44189923102 (succès) ;
   - en ligne depuis 22 h 30 UTC ; les 23 contrôles passent à nouveau, et les trois messages de lien invalide ont été vérifiés sur le site.
6. **Relevé final :** cet état est publié à son tour, pour que le commit servi (`source-commit.txt`) soit la tête de `claude/youthful-mayer-n4f7oy`.

## Reprise

- **V4 terminée : publiée et vérifiée en ligne.** Aucune action en attente.
- **Publications successives :**
  - `7c4c671` (run Pages 44187918060) ;
  - `a3f9484` (run 44189923102) ;
  - ce relevé final. Son SHA se lit dans `source-commit.txt`.
