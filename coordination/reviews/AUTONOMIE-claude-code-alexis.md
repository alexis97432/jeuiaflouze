# Revue du protocole d'autonomie — Claude Code Alexis

- **Tâche :** coordination autonome, [alexis97432/jeuiaflouze#5](https://github.com/alexis97432/jeuiaflouze/pull/5)
- **Auteur :** Codex · **Reviewer :** claude-code-alexis
- **SHA revu :** `df88ba5f25eb8291d4c8922f0ce6340887dab10b` (tête de `agent/codex/coordination-autonomie`)
- **Périmètre lu intégralement :** `git diff origin/claude/youthful-mayer-n4f7oy...df88ba5`, soit AGENTS.md (2 lignes), README.md (+4), coordination/AUTONOMIE.md (nouveau, 45 lignes).
- **Vérifications :**
  - cohérence avec AGENTS.md, PLAN.md et les prompts ;
  - exemple de commande de la § « Lire les bonnes versions » exécuté tel quel : `git show origin/agent/codex/c1-review-f0:coordination/reviews/F1-codex.md` affiche bien le rapport ;
  - ce protocole a déjà servi pendant cette session pour trouver le rapport A0 de FLK sur sa branche F1, non fusionnée.

## Défauts

Aucun bloquant.

- **m1 — mineur (AUTONOMIE.md, § Démarrage unique).** « Enchaîner les tâches autorisées et les revues sans demander à l'utilisateur » : il faut préciser que **les consignes directes de l'utilisateur dans une session priment** sur ce protocole, et que les actions difficiles à annuler (fusion, suppression de branche) restent soumises aux règles d'AGENTS.md. Formulation proposée : « Les consignes explicites de l'utilisateur priment ; ce protocole ne lève aucune règle d'AGENTS.md. »
- **m2 — mineur (§ Démarrage unique, veille de 60 s pendant 15 min).** Certains runtimes interdisent l'attente active au premier plan, ou facturent chaque réveil. La formule « si le runtime le permet » le couvre. Je propose d'ajouter : « sinon, publier la dépendance et rendre la main immédiatement ». Le texte le dit pour la fin de période, pas pour le cas sans veille possible.
- **m3 — mineur (§ Lire les bonnes versions, point 4 : « intégration autorisée après PASS »).** Il manque l'ordre des PR empilées ou dépendantes. Aujourd'hui, F1 (#3) contient F0 (#1), et l'intégration n'a pas encore A0 (#2). Proposition : « intégrer dans l'ordre des dépendances (A0 avant tout code exécutable, F0 avant F1), en fusion avec commit de merge pour conserver les SHA revus ».

## Verdict

**PASS** sur `df88ba5f25eb8291d4c8922f0ce6340887dab10b`. Le protocole est prudent : borné dans le temps, sans faux PASS, sans prétendre relancer une session. Les mineurs m1 à m3 peuvent arriver dans une PR Codex ultérieure ; ils ne bloquent pas l'intégration.
