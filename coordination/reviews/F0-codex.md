# Revue F0 — Codex

Auteur : Claude Code FLK ; reviewer : Codex. Date : 16 novembre 2026.
PR #1 : https://github.com/alexis97432/jeuiaflouze/pull/1
SHA exact : `3725541e2c5a49c35618f119895235f5157a5c97`.

**Verdict : PASS pour F0 uniquement.** Aucun défaut bloquant identifié sur ce SHA. Aucun merge effectué ; F1 reste une livraison indépendante à corriger.

## Périmètre et preuves

Checkout détaché exact de F0 ; lecture de tous les fichiers core, tests core/replay, bot, empreinte et golden, documentation de règles et fiche FLK. Lecture des deux avis produit et de la revue C0 Alexis. Vérification dans un worktree jetable combinant A0 `e84647e0a5b1acca0e724977eecddaa8d113a417` et F0, sans conflit.

Environnement : Node 24.22.1, npm 11.9.0, dépendances du lockfile A0 installées par npm ci (88 paquets).

- `npm run typecheck` sur A0 + F0 : code 0.
- `npm test` sur A0 + F0 : **94/94**, dont **77 moteur/rejeu** et 17 A0 ; assertions lues, pas seulement noms de tests.
- `npm run build` : code 0. Le build utilise encore le mock A0 et ne prouve pas le vrai rendu.
- Compilation du core exact F0 par TypeScript A0, config temporaire lib=[ES2022], types=[], strict/noUncheckedIndexedAccess/exactOptionalPropertyTypes/noEmit : code 0. Aucune dépendance DOM.
- Lecture des calculs manuels indépendants (seed 1, ticks 177/433/434), bornes parfait/contact et références xorshift32 ; les golden seuls ne suffiraient pas à vérifier les règles.

## Arbitrage des précisions F0

J'accepte pour la première version des règles les propositions explicites de FLK, cohérentes avec M6 Alexis : entiers milli, vitesse arrondie une fois par étage, plafond avant modulation, premier étage numéroté 1 avec tirage initial, départ impair gauche/pair droite, rebond avec surplus réfléchi, premier appui au tick 1, contact sans chevauchement raté avant parfait et tolérance incluse. Déduplication des appuis à l'exécution ; rejet des doublons dans un payload de rejeu déjà normalisé.

La description exacte est dans src/game/core/README.md. La correction C0 doit y aligner CONTRACTS et être relue par Alexis. Pas de seconde variante de calcul. Aucun joueur public n'a encore consommé ces règles ; toute modification ultérieure du déterminisme augmentera rulesVersion.

## Limites

Les limites de rejeu bornent le payload mais pas la partie interactive : décider fin/inactivité et admissibilité des longues parties avant classement public (M8 Alexis). Les limites fournies au replay doivent rester une configuration serveur de confiance. Un rejeu valide ne prouve pas un humain. Getters readonly : garantie TypeScript, pas gel runtime ; aucun consommateur ne doit muter ces objets.

Ce PASS ne couvre ni F1, ni téléphone réel, ni performance ou validation produit. Alexis peut intégrer F0 après vérification que #1 pointe toujours sur ce SHA. Cette livraison de rapports Codex doit elle-même être relue par Alexis, conformément au cycle.
