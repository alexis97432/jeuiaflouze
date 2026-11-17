# Serveur de classement — Pile ou Crash (V3-A3)

Service Node 22 **séparé du client**. GitHub Pages ne sert que les fichiers statiques du jeu :
il n'héberge **ni base de données ni serveur**. Sans ce service, le jeu reste entièrement
jouable ; l'écran Classement affiche « Indisponible ».

## Ce qui fonctionne

| Fonction | État |
| --- | --- |
| Tickets à usage unique (seed émise par le serveur, expiration 2 h) | Fonctionnel |
| Score **recalculé** par le rejeu partagé avec FLK (`replayRun`) ; le score envoyé par le client est ignoré | Fonctionnel |
| Vraisemblance : durée rejouée ≤ temps écoulé depuis le ticket (+2 s) | Fonctionnel |
| Tableaux global, hebdomadaire (semaine ISO UTC) et du jour (séparé), par version de règles | Fonctionnel |
| Meilleur résultat par joueur ; égalités = même rang ; ordre score › hauteur › parfaits › plus ancien | Fonctionnel |
| Pagination (50 max), `you` = rang du joueur demandé, identifiants des autres jamais renvoyés | Fonctionnel |
| Limites : corps 64 Kio, 20 000 entrées, 1 h de jeu ; quotas par adresse (tickets 30/min, scores 10/min, lectures 120/min) | Fonctionnel |
| Idempotence : même soumission → même réponse ; ticket réutilisé pour une autre partie → 409 | Fonctionnel |
| Parties avec reprise (`continues > 0`, règles v2) : jamais classées | Prêt (activé avec les règles v2 de FLK) |
| Données de démonstration (`DEMO=1`) : pseudos « Démo … », `demo: true` | Démo |
| Base de données gérée, hébergement public | **Indisponible** (dépendance externe) |

## Lancer en local

```bash
npm ci
npm run server:dev        # build + DEMO=1 + CORS pour http://localhost:5173
```

Production (après `npm run server:build`) :

```bash
PORT=8787 HOST=0.0.0.0 ALLOWED_ORIGINS=https://alexis97432.github.io DATA_FILE=./data/classement.json npm run server:start
```

Variables (aucun secret) : `PORT`, `HOST`, `ALLOWED_ORIGINS`, `DATA_FILE`, `DEMO`, `RULES_VERSIONS`
— détail dans `server/config.ts`.

Client : l'adresse est lue au build dans `VITE_LEADERBOARD_URL` (ex.
`VITE_LEADERBOARD_URL=https://classement.exemple/api/v1 npm run build`). Vide (build GitHub Pages
actuel) : l'écran Classement affiche « Indisponible » et aucune requête n'est faite.
Essai complet en local :

```bash
npm run server:dev
```

```bash
VITE_LEADERBOARD_URL=http://127.0.0.1:8787/api/v1 npm run dev
```

## API v1

- `GET /api/v1/health` → `{ ok, rulesVersions, demo }`
- `POST /api/v1/tickets` `{ mode: 'free' | 'daily', rulesVersion? }` → `201 { ticket, seed, rulesVersion, mode, day?, expiresAt }`
- `POST /api/v1/scores` `{ ticket, playerId (32 hex), pseudo (3–16), inputTicks, continueTicks? }`
  → `{ ranked: true, score, height, perfectCount, placements }` ou `{ ranked: false, reason: 'continued' }`
- `GET /api/v1/leaderboards/:global|weekly|daily?rulesVersion=&period=&offset=&limit=&player=`

Erreurs : `{ error, message }` avec 400/404/405/409/413/422/429.

## Limites connues (honnêtes)

- Un rejeu valide prouve que la partie est **possible**, pas qu'un humain l'a jouée : un bot qui
  joue en temps réel peut soumettre un score. Parade future : comptes, signalement, modération.
- `playerId` est un pseudonyme généré par l'appareil, sans compte : changer d'appareil = nouveau joueur.
- Le stockage fichier convient à une seule instance ; plusieurs instances exigent une base
  partagée (implémenter l'interface `Store` de `server/store.ts`).
- Les quotas sont en mémoire, par adresse IP vue par le serveur : derrière un proxy, il faudra
  lire l'adresse transmise par ce proxy de confiance.

## Bloqueurs externes

Hébergement du service (fournisseur, domaine HTTPS) et base gérée : à choisir par le
propriétaire du projet. Rien dans le dépôt ne nécessite de secret pour ce service.
