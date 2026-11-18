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
| E2 | Branchement v3 : contrat, liens `?v=3`, résultat, carte, classement, serveur | fait (519 tests unitaires) |
| E3 | Rendu « Pop Choc » : effets de pose, parfait, séries, Fièvre, boosts, chute, absurdités, interface en jeu | fait (`src/game/render/fx.ts`, `renderer.ts` ; 7 scénarios navigateur `tests/game/browser/v5.spec.ts`) |
| E4 | Son et vibrations coordonnés | fait (`audio.ts` : signatures des boosts, clac, boing, Fièvre, absurdités, suspension en arrière-plan ; vibrations dans le shell) |
| E5 | Accueil et résultat dans la nouvelle personnalité | fait (rayons et logo qui s'écrase à l'accueil, tampon et score qui surgit au résultat, aide des boosts) |
| E6 | Tests, séquences en navigateur, petits écrans, animations réduites, mode Fluide | fait (520 unitaires, 92 e2e, 49 moteur dont 10 V5 ; mots jamais sur la zone de pose en 390×844, 320×568, 844×390) |
| E7 | Bilan, PR, CI, fusion, publication Pages, vérification en ligne | fait : PR #51 fusionnée (`b133aa2`), publiée et vérifiée en ligne |

## Publication V5 (auto-vérification)

1. **Contrôles avant publication :**
   - CI de la PR [#51](https://github.com/alexis97432/jeuiaflouze/pull/51) en succès sur `ec948b5` (run 44207825202) : `npm ci`, typecheck, 520 tests unitaires, 92 e2e, 49 tests moteur dont 10 scénarios V5 ;
   - PR fusionnée par son auteur (exception V5) en `b133aa2`.
2. **Pages :** `pages.yml` lancé avec `ref` = `b133aa256bc9d490540d26441e8d9c09eb9932ce`. Le site sert `b133aa2` depuis 00 h 43 UTC le 18 novembre.
3. **Vérification du site en ligne,** faite depuis ce conteneur avec Chromium (profil Pixel 7).
   - **15 contrôles V5 passent :**
     - `source-commit.txt` ;
     - police, script et styles ;
     - rayons de l'accueil ;
     - « Comment jouer » qui explique les boosts et la Fièvre ;
     - jeu dessiné ;
     - partie jouée jusqu'au résultat ;
     - Rejouer, Défier un ami et Accueil visibles ;
     - **lien de défi en `?v=3`** (preuve que la version publiée joue en règles v3) ;
     - ancien lien `?v=2` accepté ;
     - 320 × 568 sans débordement ;
     - toutes les ressources servies ;
     - aucune erreur console.
   - **23 contrôles V4 passent aussi** (non-régression) :
     - thème gardé ;
     - retour du téléphone ;
     - Pause, puis Quitter ;
     - reprise avec une vie décomptée une seule fois, aussi après rechargement ;
     - « Vidéo indisponible » désactivée.
4. **Relevé final :** cet état est publié à son tour (PR de suivi), pour que le commit servi soit la tête de `claude/youthful-mayer-n4f7oy`.

## Reprise

- **V5 terminée : publiée et vérifiée en ligne.** Aucune action en attente.
- **Publications :** `b133aa2`, puis ce relevé final. Son SHA se lit dans `source-commit.txt`.
