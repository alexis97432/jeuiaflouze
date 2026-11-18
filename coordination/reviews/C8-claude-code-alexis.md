# Revue C8 (Codex, PR #43) — Claude Code Alexis

- **SHA revu** : `fd81c31877fb702a8fab983f1f0d22e8cd4d8740`. Livraison documentaire : V3-INTEGRATION.md, F7-, F8b- et F9-codex.md, status/codex.md.
- **Méthode** : lecture complète, puis vérification des affirmations sur les SHA exacts.

## Vérifications

| Affirmation | Contrôle | Résultat |
|---|---|---|
| F7 `cf95c51` compare désormais `bestPerfectStreak` et `bonusCount` | `src/game/core/replay.ts:110` sur `cf95c51` | Exact |
| F8b R1 : la carte publique ignore la matière V3 | `card.ts:114` (`Partial<Appearance>`) et `card.ts:148` (`resolveAppearance`), identiques sur `d8ba36f` et `1509f1e` | Exact |
| Ordre F6/F8 → F7 → F9 | `e702748` et `57928d7` sont ancêtres de `cf95c51` (fusion `24eb4da`) ; `cf95c51` est ancêtre de `d8ba36f` | Exact. Intégrer #39 apporte F6 et F8 sur leurs SHA validés, sans autre code. |
| « A6b émet encore un lien v1 après une partie v2 » | Corrigé dans #42 depuis `717b305` : `buildChallengeUrl(…, result.rulesVersion)`, `?v=2` lu et rejoué en v2, `?v=1` conservé (tests unitaires et e2e) | **Périmé**. La description de #42 sera mise à jour (la mention « comparable » est retirée). |
| A6b : carte absente du parcours | `main.ts` branche `createResultImage(renderResultCard)` depuis `5ab8a8e` ; essai Chromium : PNG partagé et téléchargé | Branché. La matière V3 sur la carte attend le correctif R1. |

## Contrat des liens de défi (point 3 de V3-INTEGRATION)

- `v` = version de règles de la partie source (1 ou 2). La partie de l'ami est jouée dans **cette** version. Une partie v2 n'est jamais dégradée en v1.
- `target` = **hauteur en étages** dans les deux versions. Les points ×2 ne sont jamais la cible : ils dépendent des bonus et ne se comparent pas d'une version à l'autre.
- Les anciens liens `?v=1` sont tous acceptés. Une version inconnue (`?v=3`) est refusée avec un message.

## Verdict

**PASS** sur `fd81c31`. Suite : j'intègre F7 #39 (`cf95c51`, avec F6/F8 validés), puis F9 #40 (`d8ba36f`), après vérification de la CI et de l'arbre intégré. F8b attend son correctif R1 et un nouveau PASS.
