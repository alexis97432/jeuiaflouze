# Revue V3-A3 — Serveur de classement (#32) et client (#33)

- **Auteur** : Claude Code Alexis
- **Reviewer** : Claude Code FLK, propriétaire du rejeu partagé (`replayRun`) utilisé par le serveur.
- **SHA revus**, vérifiés sur GitHub, chacun dans un worktree détaché :
  - #32 : `100828c87967acbb8ba5002348d7cd76d1ce289b` ;
  - #33 : `1dc9bc390b5d31f44061509e4c5df5edbebc6809`. Il contient #32, ainsi que #26 et #29 déjà revus.
- **Périmètre lu** :
  - `server/*.ts`, `server/README.md` et les scripts `server:*` de `package.json` ;
  - `src/platform/services/leaderboard.ts`, et dans `src/app/shell.ts` : tickets, `sendRank` et l'écran Classement ;
  - `src/main.ts`, `src/platform/storage.ts` ;
  - les tests `tests/server/*.test.ts`.

## Commandes et résultats

```
# #32
npm run typecheck → 0 ; npx vitest run → 311 passed
# #33
npm run typecheck → 0 ; npx vitest run → 337 passed ; npm run build → ✓
npx playwright test --trace off → 59 passed, 31 skipped
npm run server:build → ✓
# Essai réel du serveur (PORT=8799 DEMO=1 node dist-server/main.mjs) :
GET  /api/v1/health                   → {"ok":true,"rulesVersions":[1],"demo":true}
POST /api/v1/tickets {"mode":"free"}  → ticket 32 hex, seed tirée par le serveur
GET  /api/v1/leaderboards/global      → entrées « Démo … » marquées demo:true, tableau demo:true
POST /api/v1/scores inputTicks [1,2,3] → rejoué par le serveur : score 2, hauteur 2, rang 7/7
```

## Constats

Points positifs :
- **Le score n'est jamais déclaré.** Le serveur tire la seed (ticket à usage unique), rejoue avec `replayRun` et classe le résultat recalculé. Je l'ai vérifié sur le serveur réel : la soumission `[1,2,3]` donne 2 étages, recalculés par le serveur.
- **Idempotence** par ticket : même contenu, même réponse ; contenu différent, 409.
- **Limites** : borne de durée « pas plus long que le temps écoulé depuis le ticket », corps limité à 64 Ko (ce qui borne aussi le nombre d'entrées soumises au rejeu), quotas par adresse et par action.
- Les tableaux sont séparés par `rulesVersion` et par période. Les ex æquo partagent leur rang. Les identifiants des autres joueurs ne sont jamais renvoyés.
- **Une partie reprise n'est jamais classée** (`continues > 0`), comme convenu dans les plans F5 et #25.
- Le Défi du jour impose la seed du jour ; un défi d'ami n'est jamais classé.
- Côté client :
  - sans `VITE_LEADERBOARD_URL`, c'est-à-dire sur Pages aujourd'hui, l'écran affiche « Indisponible » et aucune requête n'est faite ;
  - les erreurs (hors ligne, quota, refus, serveur) sont distinguées, avec un « Envoyer encore » sûr grâce à l'idempotence ;
  - le résultat affiche « Score local, non vérifié » quand il n'y a pas de ticket.
- La démo est marquée partout et n'est jamais présentée comme de vrais joueurs.

Défauts :
- **m1 (mineur, à faire avec F7)** — `sendRank` n'envoie pas `continueTicks`. C'est correct en v1, mais il faudra l'ajouter (`result.continueTicks`) dès que le shell lancera des parties v2. Il faudra aussi ajouter `2` à `RULES_VERSIONS` côté serveur quand F6 sera intégrée. Sans `continueTicks`, une partie v2 reprise serait rejetée (`replay_input_after_end`) ; elle ne serait jamais classée à tort.
- **m2 (mineur, documentation)** — La seed est connue dès la délivrance du ticket, et les tickets sont préchargés. Un robot peut donc calculer un rejeu optimal hors ligne. C'est la limite déjà documentée (« un rejeu valide ne prouve pas un humain »). Le README pourrait préciser que la borne `too_fast` ne vaut que pour les parties rapides.
- **m3 (mineur, exploitation)** — `store.ts` réécrit tout le fichier JSON à chaque ticket. C'est acceptable pour un essai, et documenté comme à remplacer par une base gérée.
- **Note** — Les quotas se basent sur `remoteAddress`. Derrière un proxy d'hébergement, tous les clients partageraient la même clé. Il faudra configurer une adresse de confiance au déploiement.

## Verdict

- **#32 : PASS** sur `100828c`.
- **#33 : PASS** sur `1dc9bc3`.

Aucun défaut bloquant. Le classement fonctionne **en local avec le serveur**. Sur GitHub Pages, il reste **Indisponible** tant que le serveur n'est pas hébergé : c'est un bloqueur externe.
