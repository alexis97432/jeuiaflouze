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
