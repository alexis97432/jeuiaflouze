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
| E6 | Vérifications, séquences animées avant/après, corrections | à faire |
| E7 | PR, CI, fusion, Pages, vérification en ligne, bilan | à faire |

## Reprise

Repartir de la première étape « à faire » ci-dessus. Les étapes faites sont committées sur la branche V6.

Prochaine action précise (E6) : adapter `tests/app/*.test.ts` (shell, collection, saison, boutique, économie) et `tests/e2e/*.spec.ts` aux onglets (`nav-home`, `nav-shop`, `nav-collection`, `nav-season`, `nav-leaderboard`), aux boutons « Acheter · prix » (`buy-<id>`, `confirm-buy`), au passe à 30 niveaux (`claim-tier-N`, `claim-all`) et à la fenêtre de révélation (`reveal-equip`, `reveal-later`), puis ajouter les tests V6.
