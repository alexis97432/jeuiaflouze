# V5 — état de reprise (Claude Code Alexis)

Ce fichier sert de point de reprise : si une session s'interrompt, repartir d'ici. Il est mis à jour à chaque étape.

## Cadre exceptionnel V5 (consigne utilisateur)

- **Organisation :** Alexis dirige la V5 seul. FLK ne participe pas.
- **Autorisations :**
  - tous les fichiers, moteur compris ;
  - dépendances et ressources sous licence compatible ;
  - branches, PR et fusion de ses propres PR sans revue externe ;
  - publication sur le GitHub Pages existant.
- **Nature des contrôles :** ce sont des **auto-vérifications**, pas une revue indépendante.
- **Interdits :** dépense, abonnement, suppression de données de joueurs, divulgation de secrets.
- **Branche :** `agent/claude-code-alexis/v5-boosts-visuels`, partie de `85fb0fe` (V4 en ligne).

## Direction

Voir [`docs/V5-DIRECTION.md`](../docs/V5-DIRECTION.md) : style « Pop Choc », règles v3 avec les boosts Ralenti, Aimant, Bouclier et Fièvre, absurdités décoratives.

## Étapes

| # | Étape | État |
|---|---|---|
| E0 | Lecture de l'état réel, diagnostic et direction créative | fait |
| E1 | Règles v3 : `src/game/core/v3.ts`, rejeu, tests et rejeux de référence ; v1 et v2 intactes | fait (225 tests moteur, `tests/game/v3.test.ts`, `golden-v3.json`) |
| E2 | Branchement v3 : contrat, liens `?v=3`, résultat, carte, classement, serveur | à faire |
| E3 | Rendu « Pop Choc » : effets de pose, parfait, séries, Fièvre, boosts, chute, absurdités, interface en jeu | à faire |
| E4 | Son et vibrations coordonnés | à faire |
| E5 | Accueil et résultat dans la nouvelle personnalité | à faire |
| E6 | Tests, séquences en navigateur, petits écrans, animations réduites, mode Fluide | à faire |
| E7 | Bilan, PR, CI, fusion, publication Pages, vérification en ligne | à faire |

## Reprise

- **Dernier commit poussé :** voir `git log` de la branche.
- **Prochaine action :** E1.
