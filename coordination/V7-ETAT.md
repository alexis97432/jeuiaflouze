# V7 — état de reprise (Claude Code Alexis)

Point de reprise si la session s'interrompt. Mis à jour à chaque étape.

## Cadre exceptionnel V7 (consigne utilisateur)

- **Organisation :** Alexis pilote seul la V7, sans FLK ni Codex.
- **Autorisations :**
  - tous les périmètres utiles, moteur compris ;
  - dépendances pertinentes ;
  - branches et PR, fusion de ses propres PR **sans revue externe** ;
  - publication sur le GitHub Pages existant.
- **Exception :** cette autorisation remplace les consignes locales qui imposent l'intervention de FLK ou de Codex. Les contrôles sont des **auto-vérifications**, pas une revue indépendante.
- **Interdits :** dépense, souscription payante, suppression de progression, exposition de secrets.
- **Branche :** `agent/claude-code-alexis/v7-stabilite-musique-boutique`, partie de `a12d8bb` (V6 en ligne).

## Objectifs

1. Crashs intermittents sur téléphone : reproduire, distinguer les causes, corriger celles qui sont prouvées, dégradation propre, diagnostic local exportable.
2. Musique de fond adaptée aux univers.
3. Musiques achetables et équipables en boutique.
4. Nouvelles apparences et nouveaux univers dans toutes les raretés.
5. Rotation quotidienne réelle de la boutique.

## Étapes

| # | Étape | État |
|---|---|---|
| V7-0 | Branche, état de reprise, direction | fait |
| V7-1 | Crashs : reproduction, corrections, diagnostic | fait : corrections moteur (`738c6eb`), journal branché (Réglages → Diagnostic) |
| V7-2 | Musique procédurale originale, réglages audio | fait : 15 pistes, lecteur, centrale audio, réglages ; pistes des 4 nouveaux univers écrites, branchées en V7-4 |
| V7-3 | Boutique tournante, musiques en boutique, migration | fait : sélection du jour, musiques achetables, sauvegarde v5, tests `tests/app/v7-*.test.ts` |
| V7-4 | Nouvelles matières et nouveaux univers | fait : Papier, Mosaïque, Vitrail, Phénix ; Désert, Montagne, Fête foraine, Royaume des nuées (`461fb16`) |
| V7-5 | Vérifications, publication, bilan | vérifications faites (voir `docs/V7.md`) ; PR, fusion, Pages et vérification en ligne en cours |

## Crashs : constats (V7-1)

Outils : fuzzeur du rendu (parties simulées, tailles et densités extrêmes, blocs de 1 px, changements d'apparence, reprises) et série de parties réelles instrumentée (canvas créés et vivants, contextes audio, écouteurs, tas). Scripts dans le scratchpad de session (`v7/fuzz-entry.ts`, `v7/stress-engine.cjs`, `v7/instrument.js`).

1. **Exception prouvée → partie figée.** L'onde de célébration des légendaires (Galaxie, Cristal, Aurore, Abysse) partait avec un âge négatif. Sur un bloc étroit, son rayon devenait négatif et `ellipse()` levait une `IndexSizeError`. L'exception sortait de la boucle, qui ne se reprogrammait plus. Reproduit 72 fois en 12 parties simulées, y compris en 360 × 640. Corrigé ; le test `tests/game/stability.dom.test.ts` échoue sur la V6 et passe en V7. Après correction : 24 parties et 64 729 images, 0 erreur.
2. **Fragilité.** Toute exception de rendu arrêtait la partie. Désormais :
   - chaque couche décorative est protégée : l'erreur est signalée et la couche coupée ;
   - si le dessin principal échoue, le jeu passe en mode secours ;
   - la simulation continue toujours.
3. **Pression mémoire mesurée** (Chromium, ×3) : une partie de 40 étages créait 256 canvas, à cause des débris en cache à chaque image ; les images du décor restaient gardées entre les parties. Correctifs :
   - débris sans cache ;
   - recyclage des briques ;
   - budgets en pixels ;
   - libération en fin de partie et en arrière-plan.
4. **Rien d'anormal** sur ces points : écouteurs, boucles d'animation et tas JS stables d'une partie à l'autre. Un contexte audio était créé par partie puis fermé ; la centrale audio unique de la V7 le remplace.

## Prochaines étapes

1. PR vers `claude/youthful-mayer-n4f7oy`, CI verte, fusion (exception V7).
2. `pages.yml` avec `ref` = le SHA fusionné, puis vérification de `source-commit.txt` et du site servi.

## Reprise

- Repartir de la tête de la branche V7 si elle existe sur `origin`, sinon de `claude/youthful-mayer-n4f7oy`.
- Lire ce fichier, puis `docs/V7-DIRECTION.md` quand il existera.
