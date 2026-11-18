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
| V7-0 | Branche, état de reprise, direction | en cours |
| V7-1 | Crashs : reproduction, corrections, diagnostic | à faire |
| V7-2 | Musique procédurale originale, réglages audio | à faire |
| V7-3 | Boutique tournante, musiques en boutique, migration | à faire |
| V7-4 | Nouvelles matières et nouveaux univers | à faire |
| V7-5 | Vérifications, publication, bilan | à faire |

## Reprise

- Repartir de la tête de la branche V7 si elle existe sur `origin`, sinon de `claude/youthful-mayer-n4f7oy`.
- Lire ce fichier, puis `docs/V7-DIRECTION.md` quand il existera.
