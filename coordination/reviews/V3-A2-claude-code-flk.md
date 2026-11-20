# Revue V3-A2 — Boutique en pièces (PR #29)

- **Auteur** : Claude Code Alexis
- **Reviewer** : Claude Code FLK
- **SHA revu** : `bd461e1a6da8a135c21b0c4d2c2ed625949920d0` (contient `e02f2f6`, revu séparément), vérifié sur GitHub avant la revue, sur un worktree détaché de ce SHA.
- **Périmètre lu** :
  - `src/app/shop.ts` ;
  - les modifications de `src/app/shell.ts` (`renderShop`, `buy`, `wear`), `src/app/progression.ts` (`inventory`) et `src/app/collection-view.ts` ;
  - les tests `tests/app/shop.test.ts`, `tests/app/shell.test.ts` et `tests/e2e/a1.spec.ts`.

## Commandes et résultats

```
npm run typecheck                    → 0
npx vitest run                       → 313 passed
npm run build                        → ✓
npx playwright test --trace off      → 57 passed, 30 skipped
```

## Constats

Points positifs :
- **Achat atomique** : `purchaseWithCoins` est pur et appelé sur le document relu sous `withProgressLock`/`updateDoc`. Il refuse un objet déjà possédé, un solde devenu insuffisant et un objet inconnu, sans rien débiter. Un test couvre l'onglet périmé, sans double débit.
- **Rien n'est vendu tant que le moteur ne sait pas le dessiner** : `isSkinId` est le filtre. Avec l'intégration actuelle, la boutique affiche honnêtement « Rien à vendre ». Elle ne propose aucun faux objet.
- L'aperçu utilise `renderAppearancePreview` dans l'univers choisi, ce qui est conforme au contrat C6.
- La confirmation se fait en deux temps, avec « Non » toujours disponible. La mention « Les pièces se gagnent en jouant. Elles ne s'achètent pas. » est claire, et il n'y a aucune pression ni minuteur.
- L'inventaire survit au rechargement (`sanitizeProgress`), et la sélection d'un objet acheté est conservée.

Défauts :
- **m1 (mineur, à traiter lors de l'exposition F8)** — Quand j'élargirai `SKIN_IDS` aux 8 apparences V3 (PR #30, accord d'Alexis dans #25) :
  - `REWARD_LABELS: Record<SkinId | …>` devra recevoir les nouveaux libellés ;
  - `collectionButton` comptera `SKIN_IDS.length` dans le total : les apparences du passe et du premium gonfleront le dénominateur « x/total ».

  Je propose : un commit F8b qui exporte les ids, et un commit d'Alexis qui ajoute les libellés et un total limité aux objets obtenables. Je ne modifie pas ces fichiers.
- **m2 (mineur)** — `previewOrSwatch(..., { skin: item.id as SkinId })` : le transtypage est sûr ici, puisque `sellableItems` a déjà filtré par `isSkinId`. Un garde de type explicite le rendrait vérifiable par le compilateur.

## Verdict

**PASS** sur `bd461e1`. Ordre d'intégration recommandé : #26, puis #29, ensemble.
