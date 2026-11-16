# Consignes communes aux trois IA

Répondre en français. Identités uniques : `codex`, `claude-code-flk`, `claude-code-alexis`.
L'identité vient du prompt de lancement de l'utilisateur ; ne pas déduire Alexis de la machine ou d'un ancien CLAUDE.md.
Lire README.md, coordination/PLAN.md, coordination/AUTONOMIE.md, docs/CONTRACTS.md, docs/VALIDATION.md et son prompt avant de travailler. Lire les skills pertinents en commençant par .claude/skills/gamedev-router/SKILL.md pour le développement de jeu.

## Git et périmètres

La branche d'intégration initiale est `claude/youthful-mayer-n4f7oy` (branche par défaut constatée le 16 novembre 2026). Ne pas la renommer sans décision commune.
Créer une branche par tâche depuis son dernier état distant : `agent/<identite>/<id>-<description>`. Ne pas réutiliser une branche de machine ancienne sans vérifier son historique.
Pas de force-push, reset destructif, secrets, écrasement du travail d'un autre, ni commit sur la branche d'un autre. Pas d'édition de .claude/skills/.
Chaque propriétaire modifie ses chemins du PLAN ; modification transversale : proposition et accord du propriétaire dans un rapport ou PR avant édition. Alexis possède les fichiers racine du futur build pour éviter les conflits.
Chaque PR cible la branche d'intégration, contient tâche, SHA, fichiers, commandes et résultats réels, limites et demande de revue assignée. Ne pas fusionner sa propre PR ; intégration par Alexis uniquement après revue PASS de l'autre IA assignée. Pour une PR Alexis, FLK peut fusionner après PASS. Les docs d'amorçage Codex sont déjà sur intégration, mais leur revue reste obligatoire avant de figer les contrats.

## Revue obligatoire à chaque tâche, y compris documentation

Cycle : Codex vérifie FLK ; FLK vérifie Alexis ; Alexis vérifie Codex. L'auteur fait ses propres contrôles ET vérifie le travail de son voisin disponible à chaque fin de tâche. Les gros lots sont découpés en tâches identifiées dans PLAN.
Écrire `coordination/reviews/<tache>-<reviewer>.md` : auteur, reviewer, SHA exact, périmètre lu, commandes/résultats, défauts avec gravité et emplacement, verdict PASS ou CHANGES_REQUESTED. Revue sur checkout/worktree du SHA, pas seulement sur le résumé de l'auteur. Pas d'auto-approbation ni de revue inventée.
Un défaut bloquant revient à l'auteur, puis nouvelle revue du nouveau SHA. Une approbation d'un ancien SHA ne couvre pas des modifications ultérieures.
Si le voisin n'a encore rien livré : terminer sa livraison en `REVIEW_PENDING`, noter précisément la dépendance et vérifier les livraisons déjà disponibles. Ne pas inventer un PASS. Appliquer la veille bornée de coordination/AUTONOMIE.md si le runtime le permet, puis rendre la main si aucune tâche indépendante ne reste. Une tâche n'est DONE qu'après PASS externe et intégration ; une fonctionnalité intégrée attend encore la validation produit avant publication.

## Communication asynchrone

Chacun tient uniquement `coordination/status/<identite>.md` : tâche, état, branche, SHA/PR, tests, prochain pas, blocages et avis sur le concept. Mettre ces fichiers dans sa PR, pas en pushs concurrents sur intégration. Consulter aussi les PR ouvertes des deux autres avant chaque tâche.
Proposer une décision dans sa propre fiche : problème, options, recommandation, preuve ou hypothèse. Codex arbitre le produit après avis des deux Claude ; une interface déjà consommée exige aussi accord des propriétaires touchés. Aucun changement unilatéral du contrat.
Ne pas prétendre avoir contacté une IA externe. Le dépôt ne réveille pas une session arrêtée : un utilisateur doit relancer la session concernée.

## Qualité et produit

Livrer de petits incréments jouables et tester les vraies frontières, pas des assertions qui recopient le code. Aucun achat réel, réseau public, publicité réelle ou collecte distante requis pour jouer au MVP. Les services externes doivent avoir un mode local fonctionnel et des erreurs visibles pour le développeur.
Ne pas promettre de viralité ou inventer des statistiques, avis humains, revenus ou scores. Pas de faux classement, achats de puissance, faux compte à rebours ou sollicitations de partage forcées. Pas de dépenses engagées au nom de l'utilisateur.
