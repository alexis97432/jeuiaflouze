# Claude Code Alexis

## V8 — direction artistique, collection sombre, Noël, économie (19–21 novembre 2026)

- **Cadre :** exception de l'utilisateur ; Alexis seul, sans FLK ni Codex, fusion et publication par Alexis. Ce sont des **auto-vérifications**.
- **Branche :** `agent/claude-code-alexis/v8-direction-artistique-economie`. Le suivi est dans `coordination/V8-ETAT.md`.
- **Livré :**
  - palette propre à chaque matière ;
  - relief éclairé, ombres de contact et portées ;
  - aperçus en studio ; interface pierre et Oswald ;
  - 3 univers et 4 matières sombres, Noël (univers et 3 matières, vente saisonnière réelle) ;
  - 4 pièces au piano écrites, voix de piano synthétisée ;
  - économie recalibrée avec simulations de profils ; sauvegarde v6.
- **Bilan :** [`docs/V8.md`](../../docs/V8.md), [`docs/V8-ECONOMIE.md`](../../docs/V8-ECONOMIE.md).
- **Limites :**
  - aucun téléphone physique ;
  - aucune écoute humaine ;
  - équilibre simulé, pas observé chez de vrais joueurs.

## V7 — stabilité, musique, boutique du jour (18 novembre 2026)

- **Cadre :** exception de l'utilisateur ; Alexis seul, sans FLK ni Codex, fusion et publication par Alexis. Ce sont des **auto-vérifications**.
- **Branche :** `agent/claude-code-alexis/v7-stabilite-musique-boutique`. Le suivi est dans `coordination/V7-ETAT.md`.
- **Livré :**
  - crash reproduit et corrigé (onde des légendaires) ;
  - couches du rendu protégées ;
  - caches bornés ;
  - journal de diagnostic local ;
  - 15 musiques originales procédurales ;
  - réglages audio séparés ;
  - sélection du jour à minuit UTC ;
  - musiques en boutique ;
  - 4 matières et 4 univers (un par rareté) ;
  - sauvegarde v5.
- **Bilan :** [`docs/V7.md`](../../docs/V7.md) et [`docs/MUSIQUE.md`](../../docs/MUSIQUE.md).
- **Limites :**
  - aucun téléphone physique ;
  - aucune écoute humaine ;
  - rotation calculée sur l'appareil (suit son horloge) ;
  - équilibrage non joué.

## V6 — « Stack or Crash » (18 novembre 2026)

- **Cadre :** exception de l'utilisateur ; Alexis seul, sans FLK ni revue externe, fusion et publication par Alexis. Ce sont des **auto-vérifications**.
- **Branche :** `agent/claude-code-alexis/v6-stack-or-crash`. Le suivi est dans `coordination/V6-ETAT.md`.
- **Livré :**
  - nom anglais, manifeste et icône ;
  - 19 matières vivantes à 4 raretés ;
  - 5 univers à 6 paliers, avec découvertes ;
  - boutique aux prix dans les boutons ;
  - passe de 30 niveaux et migration v4 ;
  - barre d'onglets, collection filtrée, fenêtre de révélation, aperçus vivants.
- **Bilan :** [`docs/V6.md`](../../docs/V6.md).
- **Limites :**
  - aucun téléphone physique ;
  - fluidité mesurée seulement sans GPU ;
  - équilibrage non joué ;
  - paiements réels non connectés (premium préparé, pas en vente).

## V5 — boosts et identité « Pop Choc » (18 novembre 2026)

- **Cadre :** exception de l'utilisateur ; Alexis seul, sans revue externe, fusion et publication par Alexis. Ce sont des **auto-vérifications**.
- **Branche :** `agent/claude-code-alexis/v5-boosts-visuels`. Le suivi est dans `coordination/V5-ETAT.md`.
- **Livré :**
  - règles v3 (Ralenti, Aimant, Bouclier, Fièvre) ;
  - rendu « Pop Choc » (onomatopées, vague de compression, Fièvre, absurdités) ;
  - sons et vibrations ;
  - accueil et résultat.
- **Bilan :** [`docs/V5.md`](../../docs/V5.md).
- **Limites :**
  - aucun téléphone physique ;
  - sons jamais écoutés par un humain ;
  - fluidité mesurée seulement sans affichage ;
  - équilibrage non joué par des humains.

## V4 — interface modernisée (17 novembre 2026)

- **Cadre :** exception de l'utilisateur pour la V4 uniquement.
  - Alexis travaille seul ; FLK et Codex ne participent pas.
  - Il modifie tous les périmètres, sans revue externe.
  - Il fusionne ses propres PR et publie sur Pages après vérification.
  - Les vérifications sont des **auto-vérifications**, pas une revue indépendante.
- **Branche :** `agent/claude-code-alexis/v4-interface`. La PR, la CI, la fusion et la publication sont suivies dans `coordination/V4-ETAT.md`.
- **Livré :**
  - préférences v2 ;
  - système visuel clair et sombre ;
  - composants ;
  - tous les écrans repensés ;
  - pause et sortie de partie ;
  - retour du téléphone ;
  - fenêtres accessibles ;
  - vibrations et sons d'interface ;
  - délai de garde de la reprise ;
  - classement v2 en points.
- **Bilan détaillé :** [`docs/V4.md`](../../docs/V4.md), à partir de l'audit [`docs/V4-AUDIT.md`](../../docs/V4-AUDIT.md).
- **Limites :**
  - aucun téléphone physique ;
  - ni Safari ni Firefox ;
  - zones sûres non simulées ;
  - aucun test avec des enfants ;
  - classement en ligne, vidéos et paiements non connectés : affichés comme indisponibles, jamais simulés.

## Historique (avant V4)

## Tâches

| Tâche | État | Branche | SHA / PR | Tests |
|---|---|---|---|---|
| A0 squelette | **DONE** : PASS FLK, intégré par FLK (`3c5ecf8`) | — | [PR #2](https://github.com/alexis97432/jeuiaflouze/pull/2) | CI verte |
| A1 intégration | **DONE** : PASS FLK sur `7df764d` (PR #8), intégré (`0add695`) ; validation produit et téléphones physiques à faire | — | [PR #6](https://github.com/alexis97432/jeuiaflouze/pull/6) | CI verte sur `0add695` |
| Intégration F0 / F1 | Faite dans l'ordre du PLAN : F0 `3725541` → `bcf6f79`, F1 `b44d2a6` → `650fe5d` (PASS Codex) | — | PR #1, PR #3 | CI verte après chaque fusion |
| Guide de test téléphone (M1) | REVIEW_PENDING : accord Codex (propriétaire de `docs/`) et revue FLK | agent/claude-code-alexis/m1-test-telephone | PR à venir | paysage vérifié en émulation |
| Revues Codex (C0 v1, C1, autonomie) | PASS, intégrées | — | coordination/reviews/*-claude-code-alexis.md | — |

## Intégration du 16 novembre 2026

- Ordre suivi : A0 (FLK) → F0 #1 → F1 #3 → A1 #6, en merges classiques qui conservent les SHA revus.
- A1 : l'API GitHub refusait la fusion pour un conflit (« dirty »). Ni `ort` ni `recursive` ne le reproduisent en local : deux bases de fusion, `b44d2a6` et `e84647e`. J'ai donc fait la même fusion classique en local (`0add695`, parents `650fe5d` et `7df764d`, la tête revue reste inchangée).
  - Avant de pousser : chaîne complète sur l'arbre fusionné (`npm ci`, typecheck, 184 tests unitaires, build 9,98 Ko gzip, 25 e2e et 13 tests navigateur F1, exit 0).
  - `git diff 7df764d 0add695` sur le code et la configuration : vide. Seuls diffèrent les documents Codex déjà présents sur l'intégration.
  - GitHub a marqué la PR #6 comme fusionnée. CI d'intégration : run 14, success.

## Prochain pas

1. **m1 de la revue A1 de FLK**, avant A1.5 : n'émettre `retry`/`run_start` qu'après un montage réussi.
2. **Tests sur téléphones physiques** selon `docs/TEST-TELEPHONE.md`. Ils demandent un humain et des appareils ; aucun résultat n'est inventé ici.
3. **A1.5** (export local des mesures pour le premier playtest), après m1.

## Blocages

- Validation sur appareils réels et playtest : action humaine requise.

## Avis indépendant sur le concept (inchangé, ≤ 15 lignes)

Le genre est saturé et la seed ne fait varier que la vitesse : le « même défi » est peu perceptible. FLK fait le même constat. Je recommande de garder ce moteur et de tester un **habillage quotidien** (une seed par jour UTC, carte de résultat sans spoiler) face au défi ami, dans le test des 10 personnes, avec des ordres contrebalancés. Signal qualitatif uniquement.

