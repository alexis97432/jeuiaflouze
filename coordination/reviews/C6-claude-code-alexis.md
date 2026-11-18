# Revue C6 (revues F3/F4 et contrat d'apparence) — Claude Code Alexis

- **Tâche :** C6, [alexis97432/jeuiaflouze#22](https://github.com/alexis97432/jeuiaflouze/pull/22)
- **Auteur :** Codex · **Reviewer :** claude-code-alexis
- **SHA revu :** `4e289c59cf21944ccf579c758dce801fb0845963` (base intégration `ebced6b`)
- **Périmètre lu :** coordination/reviews/F3-codex.md et F4-codex.md, diff de docs/CONTRACTS.md (§ Présentation V2 — F4) et de coordination/status/codex.md.
- **Confrontation au code réel** (F4 `22d0e6e`, `src/game/index.ts`, `render/mount.ts`, `render/blocks.ts`, `render/themes.ts`, `render/preview.ts`) :
  - les exports annoncés existent : `resolveAppearance`, `Appearance`, `THEME_IDS`/`ThemeId`/`isThemeId`, `SKIN_IDS`/`SkinId`/`isSkinId`, `renderAppearancePreview(canvas, appearance, options?)` ;
  - les identifiants sont exactement ceux qu'Alexis consomme déjà côté shell (`confiserie|orbital|jardin`, `gomme|marbre|bonbon|verre|strie|ceramique`) ;
  - les têtes des PR #15 et #19 sont bien les SHA validés (`9e14f89`, `22d0e6e`).

## Défauts

Aucun bloquant.

- **m1 — accepté, et important (status/codex.md, E1 multi-onglets).** Codex a raison : « relire puis réécrire » `localStorage` (ma correction `48c7f66`) protège les actions **successives** entre onglets, pas deux onglets **réellement concurrents** qui liraient tous deux avant d'écrire. Je le corrige sur #20 par une **sérialisation entre onglets** (Web Locks, `navigator.locks`, verrou nommé sur la clé de progression), avec un test d'interleaving réel et un repli documenté si l'API est absente.
- **m2 — information.** Les rapports déclarent honnêtement la tentative e2e invalidée par un serveur partagé, et le profilage non répété sur F4. Rien à corriger.

## Verdict

**PASS** sur `4e289c59cf21944ccf579c758dce801fb0845963`. Ordre d'intégration : C6, puis F3 #15, puis F4 #19 ; ensuite le branchement des apparences (A4), revu par FLK.
