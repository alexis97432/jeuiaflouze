# Revue C4 (progression, économie, monétisation) — Claude Code Alexis

- **Tâche :** C4, [alexis97432/jeuiaflouze#13](https://github.com/alexis97432/jeuiaflouze/pull/13)
- **Auteur :** Codex · **Reviewer :** claude-code-alexis
- **SHA revu :** `43ebbb4a11aaba2f69f44d6a789960de4df0f523` (base intégration `46f7cb4`)
- **Périmètre lu intégralement :** coordination/ECONOMIE.md (nouveau), diffs de PLAN.md, V2.md et status/codex.md.
- **Confrontation au code réel :** la progression A3a (`src/app/progression.ts`, PR #12) et le stockage `poc:meta:v1:` (PR #12/#14), pour juger la migration.
- **Calculs réels (Python) des formules proposées :**

| Partie type | XP | Pièces |
|---|---|---|
| 5 étages, 0 parfait | 5 | 1 |
| 10 étages, 2 parfaits | 14 | **2** |
| 15 étages, 3 parfaits | 21 | 4 |
| 25 étages, 6 parfaits | 37 | 7 |
| 50 étages, 12 parfaits | 70 | 14 (plafond 25 jamais atteint en pratique) |

Seuils de niveau : niveau 2 à 100 XP, 5 à 1 000, 10 à 4 500, 20 à 19 000. Il faut ~71 parties typiques pour le niveau 5 et ~1 357 pour le niveau 20.
Calendrier : **200 pièces par semaine**. Objectifs V2 : 9 × 30 = 270. Boutique entière : 420 pièces.

## Défauts

Aucun bloquant : le document est une étude, explicitement non activée, et respecte les interdits (aucun achat fictif, aucune pub simulée, reprise hors classement). Il y a un défaut **majeur de conception économique** à corriger avant E1.

- **M1 — majeur (§ Pièces et § Calendrier, équilibre).** Avec les hypothèses actuelles, **une semaine de calendrier (200 pièces) vaut environ 100 parties typiques (2 pièces chacune)**. Ouvrir l'application sept jours rapporte plus que jouer : on récompense la présence au lieu du jeu, à l'inverse du but (« ne pas confondre réclamation quotidienne et intérêt pour la partie »). Les prix de la boutique ne peuvent alors pas être calibrés sur le jeu. Proposition, à arbitrer par Codex :
  - calendrier ramené à environ 2 parties par jour (par exemple 5, 5, 5, 5, 5, 10, 15, soit 50 pièces par semaine) ;
  - **ou** gains de partie relevés (par exemple `floor(score/3) + perfectCount`, plafond 25) ;
  - dans les deux cas, une cible écrite : « l'objet le plus cher ≈ N parties », N fixé à l'avance.
- **m1 — mineur (§ Niveaux).** La courbe est raide au-delà du niveau 10 (4 500 XP ≈ 320 parties typiques). Sans récompense cataloguée par niveau, la barre d'XP risque d'être un compteur vide. Je propose d'ajouter un titre ou un cosmétique catalogué à 2, 5 et 10, ou de ne pas afficher de niveau au-delà du dernier palier récompensé.
- **m2 — mineur, technique (§ Transaction locale).** « Pas d'état débité mais non livré » : en local, seule l'écriture **d'une même clé** `localStorage` est atomique. Je propose que solde, inventaire, XP, calendrier et objectifs vivent dans **un seul document versionné** (`poc:meta:v1:progress`, étendu en `version: 2`), écrit en une fois. Sinon un plantage entre deux clés casse la cohérence. C'est compatible avec A3a, où les déblocages sont déjà *dérivés* plutôt que stockés.
- **m3 — mineur (§ Migration +30 pièces).** Un drapeau est nécessaire : `grants: ['v2-objectives-backfill']` dans le document unique, sinon la prime de migration se rejoue à chaque chargement ou réinstallation de sauvegarde. À tester explicitement (double chargement, sauvegarde ancienne réimportée).
- **m4 — mineur (§ Calendrier, horloge locale).** Une réclamation par date UTC basée sur l'horloge locale est contournable en avançant l'heure. Le document l'admet. Je propose en plus de refuser une date **antérieure** à la dernière réclamation (horloge reculée), de ne pas « rattraper » plusieurs jours d'un coup, et d'afficher « progression locale » dans l'interface.
- **m5 — mineur, produit (§ E3/E4).** Avant toute publicité ou passe payant, il faut vérifier le public visé (mineurs : ciblage publicitaire, consentement, règles des magasins). VALIDATION.md le mentionne pour la publicité ; ECONOMIE.md devrait le rappeler comme prérequis bloquant d'E3/E4.
- **m6 — information (§ Boutique).** Graphite, Nacré et Holographique s'ajoutent aux 6 apparences V2 que FLK n'a pas encore livrées (F3/F4). Ce coût visuel est à confirmer par FLK avant de figer le catalogue.

## Découpage E1 proposé (après A3/A4, petites PR, revue FLK)

| Lot | Contenu | Estimation | Risque principal |
|---|---|---|---|
| E1a | Document de progression `version: 2` (m2) et migration idempotente depuis A3a, avec drapeaux de grants (m3) | petit | migration double |
| E1b | XP et niveaux, purs, affichés au résultat et à l'accueil | petit | courbe (m1) |
| E1c | Pièces : gains par `runId` (une seule fois), +30 par objectif, migration | petit | équilibre (M1) |
| E1d | Calendrier 7 jours : une réclamation par date UTC, horloge reculée refusée | petit | horloge locale (m4) |
| E1e | Boutique : aperçu, confirmation, transaction atomique, objet possédé non rachetable | moyen | dépend des apparences FLK (m6) |

## Verdict

**PASS** sur `43ebbb4a11aaba2f69f44d6a789960de4df0f523`, pour une étude. **M1 doit être arbitré avant d'implémenter E1c/E1d**. m2 et m3 seront appliqués dans E1a.
