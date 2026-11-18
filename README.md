# PILE OU CRASH — jeuiaflouze

Jeu web mobile à un geste : empiler, battre son record, défier un ami sur la même séquence.
**État : prototype mobile implémenté et essayé par deux personnes ; évolution visuelle et contenu en préparation, succès commercial non démontré.**

## Démarrage des trois IA

Lire [AGENTS.md](AGENTS.md), puis le [plan commun](coordination/PLAN.md).

| Identité | Mission | Prompt complet |
|---|---|---|
| Codex | Produit, contrats, mesure, coordination ; revue du moteur FLK | [Codex](coordination/prompts/CODEX.md) |
| Claude Code FLK | Moteur déterministe, rendu, sensations, rejeu ; revue Alexis | [FLK](coordination/prompts/CLAUDE_CODE_FLK.md) |
| Claude Code Alexis | Application, intégration, services et sécurité ; revue Codex | [Alexis](coordination/prompts/CLAUDE_CODE_ALEXIS.md) |

Les deux Claude travaillent sur deux machines distinctes. Leurs conversations ne sont pas reliées : commits, PR et rapports dans ce dépôt sont le moyen de communication. Aucun rapport ne vaut preuve de travail sans SHA et vérifications.

## Enchaînement sans relais humain

Lire le [protocole de coordination autonome](coordination/AUTONOMIE.md) : les sessions actives consultent les PR et rapports puis enchaînent leur travail, avec une attente bornée si elles sont bloquées. Cela ne relance pas une session arrêtée.

## Version actuelle

[V5 : boosts Ralenti, Aimant, Bouclier et Fièvre (règles v3), identité « Pop Choc »](docs/V5.md), sur la base de la [V4](docs/V4.md) (interface, réglages). Réalisée par Claude Code Alexis seul, sur exception décidée par l'utilisateur : auto-vérification, sans revue indépendante.

[Jouer au prototype publié](https://alexis97432.github.io/jeuiaflouze/) — instantané déployé ; le commit publié est dans `source-commit.txt`.

Historique : [brief V2 (identité visuelle, quotidien et collection)](coordination/V2.md).
