# Revues FLK : V3-A1 correctif (#26), A5 passe de saison (#35), A6 reprise / partage (#37)

- **Auteur** : Claude Code Alexis
- **Reviewer** : Claude Code FLK

| PR | SHA revu (vérifié sur GitHub, worktree détaché) | Verdict |
|---|---|---|
| #26 V3-A1 correctif polices larges | `88ab97cc0d62475b9fb112cad28e8cc0fe481c22` | **PASS** |
| #35 V3-A5 passe de saison | `96d52daa8fccf2c4a870433ccd6c7a01ad1dc236` | **PASS** |
| #37 V3-A6 reprise, bonus, résultats v2, partage | `d960367ca9b07f121a5fe763bcbc356784b61026` | **PASS**, suite requise pour la jouabilité (A6b) |

#29 (`337f771`) et #33 (`922685d`) ne font que fusionner `88ab97c` : ils sont couverts par cette revue et par mes PASS précédents.

## Commandes et résultats

```
#26 88ab97c : typecheck 0 · vitest 302 passed · build ✓
#35 96d52da : typecheck 0 · vitest 347 passed · build ✓
#37 d960367 : typecheck 0 · vitest 410 passed · build ✓
Fusion d'essai #37 + pile FLK F7/F9/F8b (1509f1e), worktree jetable non poussé :
  aucun conflit · typecheck 0 · vitest 433 passed · npx playwright test --trace off → 67 passed, 35 skipped
```

## #26 — correctif 320 px
`min-width: 0`, `overflow-wrap` et des onglets resserrés à 360 px ou moins, sans couper les mots des onglets. Un test e2e couvre les polices larges. Aucune remarque.

## #35 — passe de saison
Points positifs :
- La saison est finie (du 17/11/2026 au 28/02/2027, en UTC) et compte 10 paliers. Les étoiles de saison sont ajoutées dans la même écriture que les gains de la partie.
- **Chaque palier n'est réclamable qu'une fois**, par une fonction pure appelée sous verrou.
- **Le premium n'est jamais déverrouillé localement** (`premium-unavailable`).
- Une apparence gagnée reste à vie (inventaire).
- Une récompense non dessinable est marquée « Bientôt », jamais présentée comme livrée.
- Format de sauvegarde v3 : un onglet ancien passe en lecture seule et ne peut plus effacer l'inventaire ni la saison. `sanitizeSeason` borne et dé-duplique les réclamations.
- Le catalogue est conforme au plan F5 §4 et à C7 : pixel, galaxie et lave sur la piste gratuite ; or et cristal en premium.

Remarques mineures :
- **m1** — `tierStatus(..., canDraw)` et la boutique utilisent `isSkinId`, qui reste en V2. Avec F8b (#41), il faudra passer à `isAnySkinId`. Sinon pixel, galaxie et lave resteraient « Bientôt » alors qu'ils sont dessinables, et graphite, nacré et holographique resteraient hors de la boutique.
- **m2** — `unlockedSkins` filtre `SKIN_IDS` (V2). Une apparence V3 réclamée ou achetée irait dans l'inventaire, mais ne pourrait pas être choisie tant que `selected.skin` et la liste ne sont pas élargis à `AnySkinId` / `ALL_SKIN_IDS`. À faire avec m1.

## #37 — A6
Points positifs :
- **Résultats en union v1 | v2** (`run-result.ts`) : gains, record et défis calculés sur la hauteur, points affichés en v2 seulement, partie reprise marquée et hors classement. C'est conforme à C7.
- **Offre de reprise DOM** :
  - n'est montée que sur `continue-offer` ;
  - s'il n'existe aucun moyen réel, `declineContinue()` est appelé immédiatement, ce qui évite une offre vide ;
  - « Terminer » est toujours présent, le focus est placé sur le premier bouton, le dialogue est modal et une annonce est faite.
- **Idempotence** :
  - `requestId` vaut `runId:revive` ;
  - `createRewardGate` donne au plus une récompense, avec l'issue `already-rewarded` ;
  - le booléen de `continueRun()` sert de seconde garde ;
  - la démo est retirée du build de production, conditionnée par des constantes de build.
- La reprise n'est autorisée qu'en partie Libre, jamais en Tour du jour ni en défi.
- Le serveur accepte les règles v1 et v2 et reçoit `continueTicks`. Mes remarques A3 m1 et A4 m1 à m3 sont corrigées.
- Les annonces `aria-live` des bonus lisent `bonus-start`. Le shell n'affiche pas de seconde jauge, conformément à l'accord.

Suite requise (**A6b**, pour que bonus et reprise soient réellement jouables) :
- **M1 (majeur, jouabilité)** — `game-contract.ts` fixe `RULES_VERSION = 1`, et toutes les parties sont lancées en v1. Avec F7, `allowContinue` est ignoré en v1 : aucune jauge, aucun bonus, aucune offre de reprise dans l'application. Ce n'est pas un défaut du code livré, qui attendait F7, mais c'est la condition de la V3.

  Proposition :
  - lancer les parties Libre et Tour du jour en `rulesVersion: 2` ;
  - garder les liens de défi `?v=1` en v1 ;
  - accepter `?v=2` pour les nouveaux défis ;
  - demander des tickets v2 au serveur avec `RULES_VERSIONS=1,2`.
- **m3** — `resultImage` n'est pas fourni par `main.ts`. F9 (#40) est livré : `renderResultCard(canvas, { result, appearance, mode, day })`, puis `toBlob`, puis `File`.
- **m4** — Si une vie est consommée et que `continueRun()` renvoie ensuite false, le message affiché est « Reprise impossible », mais la vie n'est pas rendue. Avec F7, ce cas n'arrive qu'après `destroy` ou un changement de partie, car l'offre n'existe qu'en état `fallen`. Il faut tout de même compenser (crédit de la vie) ou consommer seulement après `continueRun() === true` dans un ordre sûr, puisque le registre serveur le permet.
- **m5** — m1 et m2 de #35 s'appliquent aussi ici, pour la boutique et la sélection.

## Verdicts
- **#26 PASS** sur `88ab97c`.
- **#35 PASS** sur `96d52da`.
- **#37 PASS** sur `d960367`.

Aucun défaut bloquant dans le code livré. La V3 jouable dans l'application demande A6b (M1, m3, m4, m5), branché sur F7 (#39), F9 (#40) et F8b (#41) dès leur PASS Codex.
