# Coordination autonome des trois sessions

Demande utilisateur du 16 novembre 2026 : ne plus transmettre les consignes entre IA. Ce protocole organise des sessions déjà lancées ; ce n'est pas un service de lancement automatique. Aucun orchestrateur, cron ou facturation API n'est installé par ce document.

## Démarrage unique

Conserver son identité (Codex, Claude Code FLK ou Claude Code Alexis). Lire AGENTS.md, son prompt, ce fichier et les PR ouvertes. Enchaîner les tâches autorisées et les revues sans demander à l'utilisateur de relayer un message.

Pendant une tâche longue, consulter GitHub aux points de contrôle et avant chaque livraison. Après livraison, poursuivre le prochain travail indépendant. Si aucun travail n'est exécutable, et que le runtime permet des attentes actives, vérifier toutes les 60 secondes pendant au plus 15 minutes par période d'inactivité. Utiliser des attentes courtes compatibles avec le runtime ; aucune boucle de raisonnement vide. Après cette période, publier une dépendance précise puis rendre la main. Une nouvelle tâche réelle ouvre une nouvelle période, pas un simple changement d'horodatage.

Ces bornes évitent de consommer sans fin les crédits et ne garantissent pas qu'une session reste ouverte. Si le runtime impose une fin de tour, l'agent doit l'annoncer ; ne pas prétendre continuer après sa réponse finale. Un orchestrateur extérieur serait nécessaire pour relancer automatiquement une session arrêtée. Codex dans cette discussion n'a pas de veille permanente.

## Lire les bonnes versions

1. `git fetch origin` sans écraser de travail local ; utiliser des worktrees pour les revues.
2. Lister les PR ouvertes et comparer leurs head SHA aux SHA déjà revus.
3. Lire les rapports et fiches **sur les branches des PR**, pas seulement sur la branche d'intégration : un rapport non fusionné reste consultable. Exemple : `git show origin/agent/codex/c1-review-f0:coordination/reviews/F1-codex.md`.
4. Priorité : corrections bloquantes de sa livraison → revue du voisin assigné → intégration autorisée après PASS → prochaine tâche de son périmètre.
5. Un même SHA ne se revoit pas à l'infini ; ne pas recréer des PR identiques ou des commits « toujours en attente ».

Une livraison non fusionnée ne vaut pas contrat approuvé. Une correction proposée doit être distinguée d'une décision acceptée. Ne pas modifier unilatéralement les chemins de l'autre agent pour débloquer sa tâche.

## Signaux persistants dans GitHub

Utiliser ses fichiers de statut et ses rapports dans ses propres PR, sans notifications externes ni mentions automatiques. Une ligne de dépendance contient : ID de tâche, responsable attendu, PR/branche et SHA, fichier à consulter, action attendue. Garder la même PR pour une même tâche tant qu'elle est ouverte.

Quand un nouveau rapport arrive, lire le détail et agir ; ne pas attendre un résumé de l'utilisateur. Quand une dépendance est résolue, reprendre sans nouvelle permission dans le périmètre autorisé. Ne pas fusionner sa propre PR ni approuver son propre code ; cycle conservé Codex → FLK → Alexis → Codex.

Si une revue comporte CHANGES_REQUESTED, l'auteur corrige, teste, publie son SHA et marque la revue à refaire. Le reviewer relit ce nouveau SHA. Pas de faux PASS pour faire avancer la boucle.

## Travail possible pendant une attente

- FLK : corriger F1, revoir A0/A1, améliorer ses tests ; aucune nouvelle mécanique changeant les règles sans accord.
- Alexis : revoir les livraisons Codex, corriger A0, préparer URL/stockage/partage A1 sur sa branche ; brancher le vrai moteur seulement après les interfaces convenues et la revue F1.
- Codex : corriger le cadrage C0, arbitrer les propositions et revoir les nouveaux SHA FLK pendant ses tours actifs.

Les playtests humains, les achats et la publication ne se remplacent pas par une boucle d'agents. Les portes de validation produit du PLAN restent applicables.

## Premier passage de relais à la rédaction

- Alexis : relire la livraison Codex sur `agent/codex/c1-review-f0` (PR #4), puis ce protocole sur `agent/codex/coordination-autonomie`. Une fois PASS sur le dernier SHA de ce protocole, intégration par Alexis suivant AGENTS.md.
- FLK : lire la revue F1 de PR #4 ; si déjà corrigée, conserver le nouveau SHA pour revue Codex. Consulter les PR Alexis et effectuer les revues disponibles.
- Codex : traiter les demandes C0 et revoir le F1 corrigé lors de son prochain travail actif. Aucun engagement de surveillance après fin de tour.

Cette liste est un point de départ daté ; les derniers rapports et SHA priment sur elle.
