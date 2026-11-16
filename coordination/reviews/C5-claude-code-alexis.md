# Revue C5 (arbitrages économie, daily, publication) — Claude Code Alexis

- **Tâche :** C5, [alexis97432/jeuiaflouze#16](https://github.com/alexis97432/jeuiaflouze/pull/16)
- **Auteur :** Codex · **Reviewer :** claude-code-alexis
- **SHA revu :** `d19deadcf07986a91644bb58f762c348da11744a` (base intégration `e3a99e2`)
- **Périmètre lu intégralement :** diffs de coordination/ECONOMIE.md, docs/CONTRACTS.md et coordination/status/codex.md.
- **Recalcul indépendant (Python) de chaque chiffre annoncé :**

| Affirmation de C5 | Recalcul |
|---|---|
| Partie de référence 10 étages / 2 parfaits | 5 pièces ✓ |
| 5 étages / 0 parfait | 1 pièce ✓ |
| 25 étages / 6 parfaits | 14 pièces ✓ |
| Holographique, Nacré, Graphite | 48, 24, 12 parties de référence ✓ |
| 21 parties + un cycle de calendrier | 105 + 50 = 155 pièces, dont 67,7 % issues des parties ✓ (« environ 68 % ») |
| Seuils des niveaux 2, 5, 10 | 40, 400, 1800 XP, soit environ 3, 29, 129 parties à 14 XP ✓ |
| Objectifs | 9 × 10 = 90 pièces ✓ |

- **Confrontation au code A3a/A3b (PR #12/#14) :**
  - `mode: daily` et `day` sur `run_start` sont déjà implémentés comme décrit ;
  - motif à deux catégories (`perfect` / `placed`, `src/app/run-tracker.ts`) ;
  - date UTC et heure locale du changement affichées ;
  - seed et date figées au lancement.

  Tout est conforme.

## Défauts

Aucun bloquant.

- **m1 — information.** Une partie à 50 étages et 12 parfaits atteint maintenant le plafond (25 pièces), alors qu'il ne servait à rien avec les valeurs initiales. Le plafond est donc réellement actif : c'est cohérent, il suffit de le savoir en playtest.
- **m2 — mineur (CONTRACTS, « lien reçu sous forme de défi reste mode challenge »).** Je l'applique ainsi. Conséquence à garder en tête : l'objectif « Terminer une Tour du jour avec au moins 8 étages » ne peut pas être rempli en jouant le lien de défi d'une Tour du jour, il faut jouer la tour elle-même. C'est cohérent avec « jamais sur score déclaré par une URL ».

## Verdict

**PASS** sur `d19deadcf07986a91644bb58f762c348da11744a`. Je prépare E1a à E1d en fonctions pures, sur une branche séparée, comme l'autorise C5. Rien ne sera fusionné avant revue FLK.
