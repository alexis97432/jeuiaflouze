# Revue C3 (direction V2) — Claude Code Alexis

- **Tâche :** C3, brief V2, [alexis97432/jeuiaflouze#10](https://github.com/alexis97432/jeuiaflouze/pull/10)
- **Auteur :** Codex · **Reviewer :** claude-code-alexis
- **SHA revu :** `8403cfaf742575b13223acdb83de5ea1c775b8e7` (tête de `agent/codex/v2-direction`, base intégration `0add695`)
- **Périmètre lu intégralement :** coordination/V2.md (nouveau), diffs de README.md, coordination/PLAN.md, des trois prompts et de coordination/status/codex.md.
- **Vérifications réelles :**
  - **Publication actuelle** (`origin/gh-pages` `48d0a7e`) :
    - `source-commit.txt` = `0add695…` ;
    - `index.html` charge `/jeuiaflouze/assets/index-1OHBKBDk.js` et le CSS correspondant ;
    - `https://alexis97432.github.io/jeuiaflouze/` et le JS répondent HTTP 200 ;
    - 0 occurrence de `__metrics` dans le bundle publié ;
    - empreinte identique à mon build de CI de `0add695` : build reproductible.

    L'affirmation « instantané de 0add695 » est exacte.
  - **Seed du jour** (algorithme proposé) recalculée indépendamment en Python. Vecteurs de référence pour `poc:daily:v1:<date>` :

    | Date | Seed |
    |---|---|
    | 2026-11-16 | 630742688 |
    | 2026-11-17 | 647520307 |
    | 2026-12-31 | 1136987600 |
    | 2027-01-01 | 3571995252 |
    | 2000-01-01 | 819662459 |

    L'algorithme est bien défini et ne renvoie jamais 0 sur ces cas (offset non nul).
  - **Contrat moteur actuel** (`src/game/index.ts`, `GameEvent`) relu face aux besoins du brief : voir m2.

## Défauts

Aucun bloquant : le brief est cohérent, fini et respecte les portes de validation (aucune monnaie, aucun achat, `rulesVersion` inchangé).

- **m1 — mineur, décision de contrat (§ Boucle, Tour du jour × CONTRACTS § Mesure).** Le contrat v1 n'autorise que `mode = free | challenge`. Une partie du jour n'est ni l'un ni l'autre. Proposition additive : `mode = 'daily'` sur `run_start`, `run_end`, `retry`, `first_placement`, `share_*`, et la date UTC (`YYYY-MM-DD`, non personnelle) sur `run_start`. Je l'implémente dans A3 comme **proposition** ; Codex tranche avant A1.5.
- **m2 — mineur (§ Contrat : « Aucun changement de GameEvent requis »).** C'est vrai pour les objectifs (`perfect`, `perfectStreak`, `floor` suffisent). Mais le « petit motif des dernières poses » de la carte partageable ne peut distinguer que *parfait / normal* : `placement` ne transporte pas la largeur coupée. Si l'on veut trois niveaux (parfait, coupe faible, coupe forte, comme dans l'avis FLK de M0), il faut un champ additif, par exemple `width` en milli. Décision à prendre avec FLK avant A4. Je pars sur deux niveaux.
- **m3 — mineur (§ Tour du jour, lisibilité).** En France, la tour change à **01 h 00 ou 02 h 00 locales** (UTC). Le brief dit « date explicite » ; je propose d'afficher aussi l'heure locale du prochain changement, calculée par le navigateur, sinon le joueur verra une tour « du jour » changer au milieu de sa soirée.
- **m4 — mineur (§ Objectifs, intégrité).** « Pas de récompense d'échec de montage » dépend de m1 de la revue A1 de FLK (un `run_start` est compté quand le montage échoue). Je corrige m1 dans A3, avant toute évaluation d'objectif.
- **m5 — suggestion (§ Acceptation 8, publication).** La publication manuelle de `gh-pages` est traçable mais fragile : build local, risque de mauvaise base. Pour A4, je propose un workflow GitHub Actions déclenché **à la main** (`workflow_dispatch`) sur la branche d'intégration. Il construirait avec `--base=/jeuiaflouze/`, écrirait `source-commit.txt` et publierait ; il ne se lancerait jamais automatiquement. À confirmer par Codex et par l'utilisateur, puisque c'est une publication.
- **m6 — risque de périmètre.** A3 et A4 représentent beaucoup d'écrans. Je découpe A3 en petites PR, comme le brief le demande :
  - **A3a** : logique pure et stockage (date du jour, catalogue d'objectifs, progression idempotente, persistance `poc:meta:v1:`, correction de m1) ;
  - **A3b** : écrans (accueil, modes, objectifs, collection, paysage).

## Identifiants proposés pour le contrat d'apparence (à convenir avec FLK, F3/F4)

- `ThemeId` = `'confiserie' | 'orbital' | 'jardin'`
- `SkinId` = `'gomme' | 'marbre' | 'bonbon' | 'verre' | 'strie' | 'ceramique'`

En ASCII, sans accent, stables. Le shell valide au bord : toute valeur inconnue retombe sur `confiserie` / `gomme`. Je n'appelle pas `appearance` dans le loader tant que FLK n'a pas exporté ces types.

## Verdict

**PASS** sur `8403cfaf742575b13223acdb83de5ea1c775b8e7`. Les mineurs m1 à m3 sont des décisions à consigner par Codex ; je les implémente comme propositions réversibles. m4 à m6 sont pris en charge dans A3/A4.
