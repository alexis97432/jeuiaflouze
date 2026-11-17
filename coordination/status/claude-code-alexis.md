# Claude Code Alexis

## V3 — vies de reprise (17 novembre 2026, PR #47)

**Constat sur `f411a95` (version en ligne)** : aucune vie ne pouvait être obtenue (vies seulement en argent réel, indisponible). La reprise n'était donc jamais proposée.

**Correctif #47 (`657f27c`), fusionné en `02037e8`, SANS revue FLK.** C'est une exception explicite de l'utilisateur, limitée à cette PR, et conditionnée à des tests verts sur le dernier commit. Vérifié avant fusion :
- tête inchangée ;
- CI `check` en succès (run 44146134019) ;
- en local : typecheck 0, 464 tests unitaires, 73 tests e2e, 39 tests navigateur.

L'absence de revue est consignée dans le message de fusion et sur la PR. FLK peut faire une revue *a posteriori*.

**Republication** : CI d'intégration verte (run 44147188613), workflow Pages vert (run 44148262079). `source-commit.txt` en ligne = `02037e8dfc8ecef3b2f8023861866be149fb5b52`.

**Vérification sur le site publié** (Chromium, 390×844, vrai moteur, vraie partie) :

| Contrôle | Résultat |
|---|---|
| Acquisition | 70 pièces → achat d'1 vie → « Tu as maintenant 1 vie », 40 pièces, compteur ❤️ 1, sauvegarde `{coins: 40, lives: 1}` |
| Offre après la première chute | Affichée. « Utiliser une vie (1) » entièrement visible, au moins 44 px de haut |
| Vidéo | « Vidéo indisponible », désactivée ; aucune mention « Mode démo » |
| Reprise | Annonce « C'est reparti ! Prêt dans 3 secondes. », compte à rebours, la partie continue |
| Décompte unique (double appui) | 0 vie, `livesSpent` = une seule reprise |
| Second raté | Fin définitive, sans seconde offre |
| Résultat | 3 étages · 3 points · « Partie avec une reprise : hors classement » |
| Sauvegarde après rechargement | Compteur 0, `livesSpent` conservé. Pièces 41 (40 + 1 gagnée), XP 150 → 153 et saison 30 → 33 : gains comptés une fois, sur la hauteur. Inventaire Graphite, sélection et palier pris intacts. Format v3. Rechargement sans changement de la sauvegarde |
| Erreurs console | Aucune |

Captures : `coordination/captures/v3-vies/en-ligne-offre.png`, `en-ligne-compte-a-rebours.png`, `en-ligne-resultat.png`.

## V3 — publiée (17 novembre 2026)

**En ligne :** https://alexis97432.github.io/jeuiaflouze/. `source-commit.txt` = `f411a95b5edc77f685506fc718889995a921c2fc`, vérifié en ligne. CI d'intégration verte (run 44137593024), workflow Pages vert (run 44139088363).
Contrôle de la page publiée dans Chromium à 390×844 : menu à 6 boutons, boutique (Graphite, Nacré, Holographique), classement « indisponible », premium « indisponible », partie v2 (étages et points), bouton d'image présent. Aucune mention de démo, aucune erreur console, aucune requête externe. Captures : `coordination/captures/v3-en-ligne/`.

| Fonction | État |
|---|---|
| Parties libres et Tour du jour (règles v2 : jauge Super, bonus Ralenti/×2, points et hauteur) | **Fonctionnel** |
| Anciens défis `?v=1` et nouveaux défis `?v=2` (cible en étages) | **Fonctionnel** |
| Menu simplifié, Récompenses, collection (17 objets obtenables) | **Fonctionnel** |
| Étoiles, niveaux, pièces, calendrier, sauvegarde v3 avec migration V2 et verrou entre onglets | **Fonctionnel** (local à l'appareil) |
| Boutique en pièces (Graphite, Nacré, Holographique) | **Fonctionnel** |
| Passe de saison 1, piste gratuite (pièces, Pixel, Galaxie, Lave) | **Fonctionnel** |
| Passe premium (Or, Cristal) | **Indisponible** : ni paiement ni comptes |
| Carte de résultat en image, partage avec secours (lien, copie, téléchargement, appui long) | **Fonctionnel** |
| Annonces accessibles (bonus, jauge, compte à rebours) | **Fonctionnel** |
| Classement mondial, semaine, jour | **Indisponible** en ligne : serveur `server/` prêt et testé, mais pas hébergé. **Démo** en local (`npm run server:dev`, joueurs « Démo … ») |
| Reprise avec une vie gagnée en jeu (30 pièces, 5 au maximum) | **Fonctionnel** depuis `02037e8` (local à l'appareil) |
| Reprise par vidéo récompensée | **Indisponible** : bouton « Vidéo indisponible » affiché et désactivé. **Démo** seulement dans un build `VITE_DEMO_SERVICES=1` |
| Vies en argent réel, achats en argent réel | **Indisponible** : registre serveur prêt et testé, mais il faut un fournisseur de paiement et des comptes |

Bloqueurs externes (décision du propriétaire du projet, voir `docs/SERVICES.md`) :
- hébergement HTTPS du serveur et base de données ;
- fournisseur de paiement et comptes joueurs ;
- régie vidéo adaptée à un public sans ciblage des enfants.

Non testé :
- téléphones physiques ;
- avis de joueurs sur les réglages de la jauge.

## Tâches

| Tâche | État | Branche | SHA / PR | Tests |
|---|---|---|---|---|
| Revue C0 v1 (Codex, PR #7) | **PASS** sur `3fdccac`, mineurs | a1-integration | coordination/reviews/C0v1-claude-code-alexis.md | confrontation au code F0/F1 |
| A0 squelette | PASS FLK sur `e84647e` ; **fusion par FLK attendue** (ordre PLAN : A0 → F0 → F1 → A1) | agent/claude-code-alexis/a0-shell | [PR #2](https://github.com/alexis97432/jeuiaflouze/pull/2) | CI verte |
| A1 intégration | **Vrai moteur branché** ; REVIEW_PENDING (FLK) | agent/claude-code-alexis/a1-integration | [PR #6](https://github.com/alexis97432/jeuiaflouze/pull/6), SHA dans la PR | voir ci-dessous |
| Revue C1 (Codex, PR #4) | PASS sur `f18e5d4`, intégrée | — | coordination/reviews/C1-claude-code-alexis.md | — |
| Revue protocole autonomie (Codex, PR #5) | PASS sur `df88ba5`, intégrée ; mineurs traités dans #7 | — | coordination/reviews/AUTONOMIE-claude-code-alexis.md | — |

## A1 — état

- **Moteur réel :** ma branche contient F1 `b44d2a6` (PASS Codex, F0 `3725541` inclus), fusionné par un commit de merge qui conserve les SHA revus. Tant que A0, F0 et F1 ne sont pas dans l'intégration, le diff de la PR #6 les montre aussi. Une fois fusionnés, il ne restera que le diff A1.
- `src/app/game-contract.ts` importe désormais les types de `src/game/index.ts` (aucune copie locale). `src/app/game-loader.ts` est un adaptateur pur (`createStartGame`) :
  - `sound = !muted` ;
  - `reducedMotion` omis, pour suivre la préférence système ;
  - `first_placement` = première pose réussie (`onEvent`), jamais un raté.
- **Mock supprimé** (`mock-game.ts` et son test) avec le bandeau. Un e2e vérifie l'absence de bandeau et que le canvas est dimensionné au DPR et réellement dessiné.
- i1 (voile de pause en double) : le voile DOM du shell est opaque, un seul message est visible. Contrôle visuel sur une capture Pixel 7, sans changement d'API.
- Son : réglable à l'accueil, donc entre les parties seulement (CONTRACTS v1, B2).
- Tests navigateur F1 de FLK : appelés par `npm run test:e2e` (script `test:game-browser`), donc présents dans la CI.
- Contenu préparé avant la bascule, inchangé : URL de défi stricte, stockage `poc:v1:` tolérant aux pannes, partage avec repli, délai de garde de 500 ms sur le résultat.
- Tests réels (SHA et sorties dans la PR) :
  - typecheck OK ;
  - `npm test` : 11 fichiers, 184/184 (A1 + F0/F1) ;
  - e2e A1 : 25 réussis, 125/125 sur 5 répétitions ;
  - navigateur F1 : 13/13 ;
  - 2 mutations de la bascule détectées.
- Limites :
  - aucun téléphone physique, Safari/WebKit ou Firefox ;
  - son non écouté ;
  - aucun playtest humain.

## Prochain pas

1. Revue FLK du nouveau SHA A1 ; corriger ses remarques.
2. Après la fusion d'A0 par FLK : intégrer F0 #1 puis F1 #3 (PASS Codex sur leurs têtes `3725541` et `b44d2a6`), en vérifiant les têtes de PR et la CI après chaque fusion.
3. Ensuite, M1 sur téléphones physiques iOS/Android, puis A1.5 (export local des mesures pour le premier playtest).

## Blocages

- Fusion d'A0 (#2) par FLK : préalable à F0/F1 dans l'ordre du PLAN.
- Validation sur appareil réel : nécessite un humain et des téléphones.

## Avis indépendant sur le concept (inchangé, ≤ 15 lignes)

Le genre est saturé et la seed ne fait varier que la vitesse : le « même défi » est peu perceptible. FLK fait le même constat. Je recommande de garder ce moteur et de tester un **habillage quotidien** (une seed par jour UTC, carte de résultat sans spoiler) face au défi ami, dans le test des 10 personnes, avec des ordres contrebalancés. Signal qualitatif uniquement.

