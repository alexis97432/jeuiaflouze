# Revue V3-A4 — Adaptateurs vidéo récompensée et paiements, registre serveur (#34)

- **Auteur** : Claude Code Alexis
- **Reviewer** : Claude Code FLK (partie reprise et revive).
- **SHA revu** : `fa44b5b17b83fef2e71aa17a0d91c7bef42dbc75`, vérifié sur GitHub, sur un worktree détaché. Il contient #32, revu séparément.
- **Périmètre lu** :
  - `src/platform/ads/rewarded.ts`, `src/platform/payments/payments.ts`, `server/payments.ts` et `docs/SERVICES.md` ;
  - les tests `tests/platform/ads-payments.test.ts` et `tests/server/payments.test.ts`.

## Commandes et résultats

```
npm run typecheck → 0
npx vitest run    → 326 passed
grep VITE_DEMO_SERVICES scripts/build-pages.sh .github/workflows/pages.yml → aucun (Pages sans démo)
```

## Constats

Points positifs :
- **Honnêteté des états.** `noAds` et `noPayments` répondent `unavailable`, et aucun prix n'est inventé (`price` → `null`). La démo est étiquetée « Mode démo » et n'existe qu'en dev ou dans un build marqué ; le build Pages ne la contient pas.
- `createRewardGate` donne **une seule récompense** par `requestId`. Il fusionne les appuis en vol et borne l'attente : une régie muette donne `error`, jamais une reprise. C'est conforme à mon contrat : le moteur attend `continueRun()` et ne valide jamais une vidéo lui-même.
- **Registre serveur** :
  - un reçu n'est crédité qu'une fois et ne peut pas passer d'un compte à l'autre ;
  - une vie n'est consommée qu'une fois par `requestId` ;
  - un remboursement retire seulement ce qui n'a pas été consommé, sans solde négatif ;
  - les droits de démo sont séparés des droits vérifiés.
- `docs/SERVICES.md` sépare clairement Fonctionnel, Démo et Indisponible, et nomme les bloqueurs externes (hébergement, prestataire de paiement et comptes, régie, public visé).

Défauts :
- **m1 (mineur, avant exposition HTTP)** — `consumeLife` rejoué avec le même `requestId` renvoie toujours `demo: false`, même si la première consommation avait utilisé une vie de démo. Une reprise de démo rejouée pourrait alors être présentée comme une reprise avec vie vérifiée. Correction proposée : mémoriser `demo` dans `consumed`.
- **m2 (mineur, UX)** — `createRewardGate.request` renvoie `'dismissed'` pour une demande déjà récompensée : le message affiché serait « Vidéo fermée », qui est inexact. Mieux vaut une issue `already-rewarded`, ou ne rien afficher.
- **m3 (à noter)** — Si la limite de 60 s expire mais que la régie confirme ensuite, le joueur n'obtient pas sa reprise. C'est sûr (aucun faux succès), mais à expliquer à l'écran.
- **Note** — Ces adaptateurs ne sont **pas encore branchés** : aucun écran de reprise, aucune route HTTP du registre. C'est cohérent avec le moteur : la reprise côté jeu arrive avec F7.

## Verdict

**PASS** sur `fa44b5b`. Les adaptateurs et le registre sont prêts et testés, mais **non branchés**. Je demande la correction de m1 avant toute exposition HTTP du registre.
