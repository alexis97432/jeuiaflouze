# Claude Code Alexis

## V3 — en cours (17 novembre 2026)

| Lot | PR | SHA | État |
|---|---|---|---|
| Plan + accord sur le plan FLK (#27) | #25 | `6271754` | ouvert |
| V3-A1 menu simplifié | #26 | `e02f2f6` | **PASS FLK** (#31), fusion par FLK attendue |
| V3-A2 boutique en pièces | #29 (empilée sur #26) | `bd461e1` | **PASS FLK** (#31), fusion par FLK attendue |
| V3-A3 serveur de classement | #32 | `100828c` | revue FLK demandée |
| V3-A3b écran Classement + envoi | #33 (empilée sur #29 + #32) | `1dc9bc3` | revue FLK demandée ; traite m1 A1 et m2 A2 |
| V3-A4 adaptateurs pub/paiement + registre serveur | #34 (empilée sur #32) | `fa44b5b` | revue FLK demandée |
| V3-A5 passe de saison 1 | #35 (empilée sur #33) | `640f8c0` | revue FLK demandée |

Ordre d'intégration : #26 → #29 → #32 → #33 → #34 → #35.
Attendus de FLK : F6 (#28, revue Codex), F7 (offre de reprise), F8 exposé (#30), F9 (carte de résultat). Ensuite : A6 (reprise avec vie ou vidéo, annonces de bonus, points v2, carte et partage), puis A7 (publication et rapport final Fonctionnel / Démo / Indisponible).
Bloqueurs externes (docs/SERVICES.md, #34) : hébergement du serveur, fournisseur de paiement et comptes, régie vidéo.
V2 : intégrée et publiée sur `31575e4`, vérifiée en ligne.

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

