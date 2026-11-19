# V8 — état de reprise (Claude Code Alexis)

Point de reprise si la session s'interrompt. Mis à jour à chaque étape.

## Cadre exceptionnel V8 (consigne utilisateur)

- **Organisation :** Alexis pilote seul la V8, de la conception à la publication, sans FLK ni Codex.
- **Autorisations :**
  - tous les périmètres utiles ;
  - dépendances pertinentes ;
  - branches et PR, fusion de ses propres PR **sans revue externe** ;
  - publication sur le GitHub Pages existant.
- **Exception :** cette autorisation remplace les consignes locales qui imposent FLK ou Codex. Les contrôles sont des **auto-vérifications**, pas une revue indépendante.
- **Interdits :** dépense, suppression de progression, exposition de secrets.
- **Branche :** `agent/claude-code-alexis/v8-direction-artistique-economie`, partie de `555ef40` (V7 en ligne).

## Constats de départ (audit du 19 novembre)

1. **Collection « bleu, mauve » : cause trouvée.** Mesure des 32 aperçus affichés (`audit.cjs`, teintes des pixels) :
   - une matière n'a **pas de couleur propre**. Elle dessine une texture sur la couleur d'étage de l'**univers** (`theme.blocks`) ;
   - les aperçus de matières sont tous dessinés sur le ciel pastel de Confiserie. Les 23 cartes montrent donc le même couple lavande et menthe (teintes 150° et 240°, 30 à 35 % des pixels chacune) ;
   - seules Lave, Or, Bois et Phénix sortent du lot ;
   - 6 aperçus sur 32 sont dominés par le bleu-violet (Galaxie, Aurore, Abysse, Cité néon, Orbital, Royaume des nuées).
2. **Aspect jouet :** briques très arrondies, contour foncé de dessin animé, police Fredoka arrondie, ciels pastel, pas d'ombre portée.
3. **Économie** (détail dans `docs/V8-ECONOMIE.md`) :
   - la partie rapporte jusqu'à 25 pièces ;
   - le passe donne des étoiles égales à l'XP (jusqu'à 70 par partie) et ses 10 premiers niveaux tombent en une dizaine de parties ;
   - les prix vont de 60 à 560 pièces ;
   - aucun double versement trouvé dans le code ; à confirmer par tests.

## Décisions

- **Palette par matière :** chaque matière a sa palette (3 à 5 tons d'une même famille) et ne prend plus les couleurs de l'univers. L'univers éclaire seulement : teinte de lumière et ambiance.
- **Familles de couleurs :** ambre, cuivre et bronze ; rouge profond, braise et noir ; émeraude et minéraux ; ivoire, graphite et métal ; tons naturels ; tons glacés ; monochromes. La rareté reste un repère d'interface (liseré, pastille), jamais la teinte de l'objet.
- **Relief :**
  - biseaux et arêtes éclairés par une lumière haute à gauche ;
  - ombres de contact entre étages et ombre portée de la tour sur le décor ;
  - coins moins arrondis, plus de contour de dessin animé.
- **Aperçus de matières :** fond de studio neutre, avec un éclairage et une ombre. Chaque matière s'y lit seule.
- **Collection dark :**
  - univers : Forêt de brume (rare), Cathédrale (épique), Cœur d'obsidienne (légendaire) ;
  - matières : Ardoise (commun), Fer forgé (rare), Ébène (épique), Obsidienne (légendaire) ;
  - piano original pour chaque univers sombre.
- **Noël :**
  - univers Veillée de Noël (légendaire, 6 paliers) ;
  - matières Givre (rare), Velours (épique), Sapin d'or (légendaire) ;
  - musique piano, célesta et cloches ;
  - en vente chaque année du 20 novembre au 6 janvier (jours UTC), dans une section « Noël » de la boutique, hors rotation. Les objets restent possédés à vie.
- **Économie :** gains et prix recalibrés ensemble, à partir de simulations de profils (`docs/V8-ECONOMIE.md`). Pièces et possessions conservées.

## Étapes

| # | Étape | État |
|---|---|---|
| V8-0 | Branche, audits, décisions | fait |
| V8-1 | Économie : simulation, recalibrage, migration, tests | fait (`f772b97`) |
| V8-2 | Relief, palettes par matière, aperçus studio, police | fait (`666aaa4`) |
| V8-3 | Collection dark (univers, matières, piano) | fait : 3 univers, 4 matières, 3 pièces de piano écrites |
| V8-4 | Noël (univers, matières, musique, règle saisonnière) | fait : univers, 3 matières, valse « Veillée », section saisonnière |
| V8-5 | Vérifications, PR, fusion, publication, bilan | à faire |

## Reprise

Scripts de session (scratchpad, à recréer si perdus) :
- `v8/audit.cjs` : teintes des aperçus de la collection ;
- `v8/shoot-entry.ts` et `v8/shoot.cjs` : images réelles du jeu, par univers, matière et hauteur ;
- `v8/shots.cjs` : accueil et partie dans l'application construite.

Reste à faire (V8-5) :
- doc `docs/V8.md` et `docs/V8-ECONOMIE.md` ;
- e2e (prix, calendrier, section Noël) ;
- stabilité : fuzzeur et parties enchaînées sur les nouveaux contenus ;
- mesures audio des pistes piano ;
- PR, CI, fusion, Pages, contrôle en ligne.
