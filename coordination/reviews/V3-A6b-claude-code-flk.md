# Revue FLK : V3-A6b — shell final V3 (#42, brouillon)

- **Auteur** : Claude Code Alexis
- **Reviewer** : Claude Code FLK
- **SHA revu** : `875fc8e9548d220d43a2a69e906c2a57349fa5b9`, tête actuelle vérifiée sur GitHub, sur un worktree détaché.
- **Périmètre lu** :
  - `game-contract.ts` (règles de jeu et de liens), `challenge-url.ts` (`?v=1|2`) ;
  - `shell.ts` (configuration de partie, offre de reprise, partage) ;
  - `result-image.ts`, `main.ts`, `progression.ts` (catalogue `AnySkinId`), `collection-view.ts` ;
  - les tests associés.

## Commandes et résultats

```
875fc8e : typecheck 0 · vitest 453 passed · build ✓
875fc8e + F8b corrigé 28c0ec1 (fusion d'essai, worktree jetable) :
  aucun conflit · typecheck 0 · vitest 454 passed · npx playwright test --trace off → 71 passed
git show 875fc8e:src/game/render/card.ts → resolveAppearance (V2) aux lignes 18 et 148
```

## Constats

Points positifs, conformes à C7 et C8 :
- **Règles** : `PLAY_RULES_VERSION = 2` pour les parties Libre et Tour du jour. Un lien `?v=1` reste joué en v1. Le lien partagé reprend `result.rulesVersion` : **une partie v2 donne un lien v2**, jamais un défi v1 avec une seed v2. La cible reste une hauteur en étages. Les tickets du classement sont en v2.
- **Reprise** : branchée sur le vrai F7. La vie est rendue si la reprise n'a pas lieu (A6 m4 corrigé).
- **Carte F9** : branchée via `createResultImage`, avec `renderResultCard`, `toBlob` et `File`. Si la carte ou l'encodage est impossible, seul le lien est partagé, et le shell le dit.
- **Apparences V3** :
  - catalogue `AnySkinId` dans la boutique, le passe, la collection et la sélection ;
  - libellés présents ;
  - total de la collection limité aux objets obtenables (or et cristal exclus) ;
  - anciens déblocages conservés.

Défauts :
- **R1 (bloquant pour la carte, dépendance FLK déjà corrigée)** — #42 embarque F8b `1509f1e`, que Codex a refusé dans C8. Sur ce SHA, `renderResultCard` passe par `resolveAppearance` (V2) : un skin V3 choisi est dessiné **en Gomme** sur la carte. `result-image.ts` force le type avec `appearance as Appearance` et affirme en commentaire que « F9 accepte une matière V3 au dessin ». C'est inexact sur ce SHA.

  À faire :
  - refusionner F8b `28c0ec1` (correctif R1, revue Codex demandée) ;
  - retirer le transtypage et le commentaire : `ResultCard.appearance` y est `Partial<AnyAppearance>` ;
  - ajouter un test shell montrant que la carte d'un skin V3 choisi diffère de celle de Gomme. Mon test `tests/game/card.test.ts` « F8b R1 » le prouve côté moteur.
- **m1 (mineur, économie)** — `unlockedSkins` accepte tout identifiant de l'inventaire local, `or` et `cristal` compris. En modifiant la sauvegarde locale, on peut donc sélectionner une apparence **premium**, que C4 réserve aux droits vérifiés par le serveur. C'est sans enjeu de paiement aujourd'hui, puisque le premium est indisponible. Je propose de n'accepter depuis l'inventaire local que les objets obtenables en local (pièces, passe gratuit), et de réserver `or` et `cristal` à un droit serveur.
- **m2 (rappel)** — Les fusions de F7, F9 et F8b dans cette branche sont annotées « NON revu par Codex ». F7 et F9 ont depuis leur PASS dans C8 et sont intégrés. Il faut refaire la fusion depuis l'intégration à jour pour retirer ces mentions périmées.

## Verdict

**CHANGES_REQUESTED** sur `875fc8e`, à cause de R1. La PR étant en brouillon, rien n'est fusionné. Je demande une nouvelle revue FLK sur le SHA qui embarquera F8b `28c0ec1` (après PASS Codex) et retirera le transtypage. Le reste du shell est prêt.

---

# Nouvelle revue sur `c0428ddbf48c41264f68eda4d5be0e41d5f9fb0c` (tête actuelle, vérifiée sur GitHub)

État de la base : intégration `565367d`, qui contient F8b `28c0ec1` (PASS Codex C9). #42 ne modifie plus `src/game`, et `git merge-tree` ne trouve aucun conflit.

## Commandes et résultats (arbre réellement fusionné : intégration `565367d` + `c0428dd`, worktree jetable)

```
npm run typecheck → 0
npx vitest run → 456 passed
npm run build → ✓
grep "Mode démo : pas de vraie vidéo" / "aucun paiement réel" / createDemoAds dans dist → 0
  (seule chaîne « Mode démo » présente : l'étiquette du classement, affichée uniquement si le serveur renvoie demo:true)
npx playwright test --trace off → 71 passed
CI GitHub « check » sur c0428dd → success
```

## Points de la revue précédente

- **R1 corrigé** :
  - `result-image.ts` transmet `AnyAppearance` sans transtypage, et le commentaire inexact a été retiré ;
  - le test `tests/app/result-image.test.ts` utilise la **vraie** `renderResultCard` : Graphite et Lave donnent une image différente de celle de Gomme pour la même partie.
- **m1 corrigé** : `unlockedSkins` n'accepte depuis l'inventaire local que les skins V2 et les apparences V3 obtenables. Or et Cristal ne sont jamais débloqués par une sauvegarde.
- **m2 corrigé** : la PR a été refaite depuis l'intégration et ne contient plus que le shell.

## Contrôles de C8

- **Parties** : Libre et Tour du jour se jouent en v2. Un lien `?v=1` reste joué en v1.
- **Liens partagés** : `buildChallengeUrl(…, result.rulesVersion)` reprend la version de la partie source. Une partie v2 n'est jamais transformée en défi v1. `?v=3` est refusé, et la cible reste une hauteur.
- **Classement** : envoi de `continueTicks` en v2 ; une partie reprise reste hors classement.
- **Reprise** : seulement en Libre et seulement si un moyen réel existe. En production, il n'y a ni vidéo ni vie.

## Remarque non bloquante

L'inventaire local accepte aussi les identifiants V2 (`SKIN_IDS`), qui sont normalement gagnés par les objectifs. C'est sans enjeu commercial, puisque la progression est locale et modifiable par construction (ECONOMIE.md). À garder en tête si ces skins deviennent un jour payants.

## Verdict

**PASS** sur `c0428dd`. Fusion par FLK après CI verte, conformément à AGENTS.md (FLK fusionne les PR d'Alexis après PASS).
