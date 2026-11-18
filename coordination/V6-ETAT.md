# V6 — état de reprise (Claude Code Alexis)

Point de reprise si la session s'interrompt. Mis à jour à chaque étape.

## Cadre exceptionnel V6 (consigne utilisateur)

- **Organisation :** Alexis pilote seul la V6, sans FLK.
- **Autorisations :**
  - tous les périmètres, moteur compris ;
  - dépendances utiles ;
  - branches et PR, fusion de ses propres PR **sans revue externe** ;
  - publication sur le GitHub Pages existant.
- **Exception :** cette autorisation remplace les règles locales qui imposent l'intervention d'une autre IA. Les contrôles sont des **auto-vérifications**, pas une revue indépendante.
- **Interdits :** dépense, abonnement payant, suppression de progression, exposition de secrets.
- **Branche :** `agent/claude-code-alexis/v6-stack-or-crash`, partie de `c59777e` (V5 et correctif du défi, en ligne).
- **Direction :** [`docs/V6-DIRECTION.md`](../docs/V6-DIRECTION.md).
- **Captures avant :** faites dans le harnais moteur (scratchpad de session), à refaire depuis `c59777e` si elles sont perdues.

## Étapes

| # | Étape | État |
|---|---|---|
| E0 | Direction, état de reprise | fait |
| E1 | Catalogue et raretés (moteur et application) | fait (`src/app/catalog.ts`, raretés moteur exportées) |
| E2 | Matières vivantes (`drawBlock` en couches, textures, animations, effets par rareté) | fait pour le moteur (`materials.ts`, `blocks.ts`, `rarity.ts`, effets de pose et aura dans `renderer.ts`) ; aperçus animés en E5 |
| E3 | Univers à plusieurs plans, paliers 0/5/10/20/35/50, découvertes | fait pour le moteur (`scene.ts`, `worlds/*.ts`, `themes.ts`, aperçus vivants `preview.ts`, carte avec scène et cadre de rareté) ; 236 tests moteur verts |
| E4 | Stack or Crash, boutons de boutique et états, passe de 30 niveaux et migration | fait (nom, manifeste, icône ; `shop.ts`, `season.ts`, `economy.ts` v4) ; tests à adapter en E6 |
| E5 | Menus : onglets, collection, révélation, aperçus animés | fait (`shell.ts`, `collection-view.ts`, `preview-animator.ts`, `styles/v6.css`) ; tests à adapter en E6 |
| E6 | Vérifications, séquences animées avant/après, corrections | fait : typecheck, 556 unitaires, build, 96 e2e, 49 moteur ; optimisations mesurées ; captures et GIF dans `coordination/captures/v6/` ; bilan `docs/V6.md` |
| E7 | PR, CI, fusion, Pages, vérification en ligne, bilan | fait : PR #54 fusionnée (`5675a05`), publiée et vérifiée en ligne |

## Publication V6 (auto-vérification)

1. **Avant publication :** CI de la PR [#54](https://github.com/alexis97432/jeuiaflouze/pull/54) verte sur `85e5409` (run 44319918260). PR fusionnée par son auteur (exception V6) en `5675a05`.
2. **Pages :** `pages.yml` lancé avec `ref` = `5675a0566f28ca8c261407f9df842a421754e341`. Le site sert ce commit depuis 14 h 17 UTC le 18 novembre.
3. **Site en ligne :** 24 contrôles passent, dans Chromium avec un profil Pixel 7, depuis ce conteneur.
   - **Nom et ressources :**
     - `source-commit.txt` ;
     - manifeste « Stack or Crash » et icône ;
     - titre de la page et titre de l'accueil.
   - **Écrans :**
     - 5 onglets ;
     - boutique (pièces du jeu, prix dans le bouton) ;
     - collection (24 aperçus dessinés, rareté écrite) ;
     - passe (niveau sur 30, 30 niveaux, premium « Argent réel » non achetable).
   - **Partie :**
     - partie réelle jusqu'au résultat ;
     - lien de défi `?v=3` ;
     - ancien lien `?v=2` accepté.
   - **Migration** d'une sauvegarde V5 : Pixel déjà récupéré, sauvegarde v4, rien redonné.
   - **Divers :**
     - 320 × 568 sans débordement ;
     - toutes les ressources servies ;
     - aucune erreur console.
4. **Relevé final :** cet état est publié à son tour (PR de suivi), pour que le commit servi soit la tête de `claude/youthful-mayer-n4f7oy`.

## Reprise

- **V6 terminée : publiée et vérifiée en ligne.** Aucune action en attente.
- **Publications :** `5675a05`, puis ce relevé final. Son SHA se lit dans `source-commit.txt`.
