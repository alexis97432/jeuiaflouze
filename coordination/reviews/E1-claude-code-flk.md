# Revue E1a–E1d (progression v2, logique pure) — Claude Code FLK

- **Tâche :** E1a à E1d, [alexis97432/jeuiaflouze#18](https://github.com/alexis97432/jeuiaflouze/pull/18) (brouillon, empilée sur A3b #14 et A3a #12)
- **Auteur :** claude-code-alexis · **Reviewer :** claude-code-flk
- **SHA revu :** `a42ab18fe2a68991934c982d22a4d8240b650ba6`, sur un worktree détaché. Diff propre à E1 : commit `7eef913` (`src/app/economy.ts`, `tests/app/economy.test.ts`, deux fichiers nouveaux).
- **Périmètre lu :** `src/app/economy.ts` en entier, titres et assertions de `tests/app/economy.test.ts`, règles de `coordination/ECONOMIE.md` (C4) et arbitrages C5 (intégrés).

## Commandes et résultats réels (`npm ci` propre, Node 22.23.4)

| Commande | Résultat |
|---|---|
| `npm run typecheck` | exit 0 |
| `npm test` | 15 fichiers, **247/247** (UTC+14) |

**Conformité à C5**, vérifiée dans le code et par mes sondes :
- seuils 40 / 400 / 1800 XP aux niveaux 2 / 5 / 10, pas de niveau 11, titres aux niveaux 2, 5 et 10 ;
- XP = min(score, 50) + 2 × min(parfaits, 10) ;
- pièces = min(25, ⌊score / 3⌋ + parfaits), plus 10 par objectif ;
- calendrier 5, 5, 5, 5, 5, 10, 15 ;
- prime de 10 pièces par objectif déjà accompli, versée une fois ;
- document unique `version: 2`.

**Sondes supplémentaires** (fichier temporaire supprimé) :
- **réussies** :
  - bornes de niveau (0, 39, 40, 399, 400, 1799, 1800, 10⁷) ;
  - migration v1 → v2 idempotente après aller-retour JSON (30 pièces pour 3 objectifs) ;
  - donnée illisible → 0 pièce ;
  - calendrier : deuxième réclamation le même jour refusée, date antérieure refusée, absence sans remise à zéro ni rattrapage ;
- **échouées** : 2 sondes, détaillées en m2 et m3 ci-dessous.

## Défauts

Aucun bloquant **pour une logique pure non branchée**. Deux points devront être réglés au plus tard dans la PR de branchement au shell.

**M1 — majeur pour le branchement (`migrateProgress`, chemin « non v2 »).** Tout document sans `version: 2` est traité comme un v1 d'A3a : l'XP repart à 0 et les pièces sont **recalculées** à partir de la seule prime. Or le shell A3 actuel lit la progression avec `sanitizeProgress`, qui ne garde que les champs A3, puis la réécrit (après une partie, après « Choisir »). Si un seul chemin d'écriture du branchement garde ce comportement, le joueur **perd son XP et ses pièces** au rechargement suivant. Sonde : trois cycles « `sanitizeProgress` puis `migrateProgress` » ramènent un document à XP 0 et à la prime seule.

Sans y être tenus pour cette PR, je demande pour le branchement :
- lecture unique par `migrateProgress`, et écriture du `ProgressDoc` complet ;
- un test qui fait passer chaque chemin d'écriture du shell (fin de partie, choix d'apparence, réclamation du calendrier) et vérifie que `version`, `xp` et `coins` survivent.

**m2 — mineur (`applyRunEconomy`).** Le commentaire annonce « idempotent par runId, même garantie qu'A3a ». C'est vrai pour les objectifs, déjà filtrés, mais **pas pour l'XP et les pièces au-delà des 50 dernières parties mémorisées**. Sonde : une partie rejouée après 50 autres rapporte de nouveau 14 XP et 5 pièces. Aucun chemin de l'interface ne réapplique une ancienne partie aujourd'hui. Il faut néanmoins corriger le commentaire, ou garder un index borné plus large, ou les deux.

**m3 — mineur (`migrateProgress`, compatibilité ascendante).** Un document `version: 3`, écrit par une future version puis relu par celle-ci (onglet ancien, retour arrière de publication), est réinitialisé : sonde XP 0 et pièces 0, au lieu de 900 et 400. Suggestion : pour une version supérieure, lire en mode dégradé sans écraser (pas d'écriture tant que la version est inconnue), ou au moins conserver `xp` et `coins`.

**i1 — information.** E1e (boutique) attend mon avis visuel. Je l'ai donné dans la PR F4 (#19) : Graphite, Nacré et Holographique sont faisables dans `src/game/render/blocks.ts`, et soumis aux mêmes tests. Leurs identifiants devront rejoindre `SKIN_IDS` côté moteur, et non `inventory` seul, pour que `appearance` les accepte.

## Points solides

- **Une seule clé, une seule écriture** : pas d'état « débité mais non livré ».
- Le grant de migration est **stable et idempotent** ; un document créé directement en v2 n'a rien à rattraper.
- Calendrier robuste à l'horloge reculée, sans rattrapage ni perte de série. Les dates sont comparées en `YYYY-MM-DD`, ce qui est sûr.
- **Toutes les valeurs sont bornées** (XP, pièces, cycle, inventaire filtré par expression régulière).
- Aucun fichier existant modifié ; la logique est testable sans DOM.

## Verdict

**PASS** sur `a42ab18fe2a68991934c982d22a4d8240b650ba6`, **pour la logique pure uniquement**. M1 devient bloquant dans la PR de branchement, si celle-ci n'apporte pas le test demandé. m2 et m3 sont à corriger avant toute activation de la boutique (E1e). Ce PASS ne couvre aucun SHA ultérieur.
