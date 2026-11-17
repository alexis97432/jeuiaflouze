# Services de Pile ou Crash (V3) — état et configuration

Le jeu gratuit ne dépend d'**aucun** service. Chaque service manquant a un état visible et honnête :

| État | Sens pour le joueur |
| --- | --- |
| **Fonctionnel** | Marche pour de vrai. |
| **Démo** | Libellé « Mode démo » : rien de réel (aucun paiement, aucune vraie vidéo, joueurs inventés). Seulement en dev (`npm run dev`) ou dans un build de test marqué `VITE_DEMO_SERVICES=1`. |
| **Indisponible** | Le bouton ou l'écran l'indique ; le reste du jeu continue. |

## Architecture

| Couche | Dossier | Rôle |
| --- | --- | --- |
| Client (GitHub Pages) | `src/app`, `src/game` | Jeu, menus, progression locale. |
| Progression locale | `src/app/economy.ts`, `src/platform/storage.ts` | Étoiles, pièces, calendrier, inventaire : `localStorage` + verrou Web Locks entre onglets. **Ne protège rien d'acheté** : un droit payé exige le serveur. |
| Services client | `src/platform/services`, `src/platform/payments`, `src/platform/ads` | Adaptateurs : `none` (indisponible), `demo`, `real`. |
| Serveur | `server/` | Classement (fonctionnel) ; registre d'achats (prêt, non exposé). |

## État par fonction

| Fonction | État sur la version publiée | Ce qui manque pour « Fonctionnel » |
| --- | --- | --- |
| Parties, Défi du jour, progression, boutique en pièces | Fonctionnel | — |
| Classement global / semaine / jour | Indisponible sur Pages ; fonctionnel avec `server/` hébergé | Héberger `server/` en HTTPS et builder avec `VITE_LEADERBOARD_URL` (voir `server/README.md`). |
| Vidéo récompensée pour la reprise | Indisponible : bouton « Vidéo indisponible » affiché et désactivé dans l'offre ; Démo en dev | Choisir une régie compatible web et un public sans ciblage d'enfants, écrire l'adaptateur `real`. |
| Vies de reprise gagnées en jeu (30 pièces, 5 au maximum) | Fonctionnel (local à l'appareil) | — |
| Vies en argent réel, passe premium | Indisponible ; Démo en dev | Fournisseur de paiement, **comptes joueurs** (relier un droit à une personne), endpoint de vérification de reçus et de remboursements branché sur `server/payments.ts`. |

## Règles tenues dans le code

- Aucun débit réel, aucun faux succès : le client ne donne jamais un droit sur la seule parole
  du fournisseur ; seul le serveur crédite un reçu vérifié (`server/payments.ts`).
- Un reçu est crédité une fois ; une vie est consommée une fois par reprise (`requestId`) ;
  un remboursement retire le droit ou les vies restantes.
- Les droits de démo sont rangés à part (`demo`) et ne valent jamais achat vérifié.
- Une vidéo ne donne sa récompense qu'une fois, même en cas de double appui, de rappel répété ou
  de retour d'arrière-plan (`createRewardGate`) ; refus, absence de vidéo, erreur : pas de reprise.
- Les pièces ne s'achètent pas ; une apparence gagnée ne devient jamais payante.

## Bloqueurs externes (décision du propriétaire du projet)

1. Hébergement HTTPS du serveur et base de données gérée.
2. Fournisseur de paiement et système de comptes.
3. Régie de vidéos récompensées (règles sur l'audience : le jeu vise un public large, sans ciblage
   publicitaire des enfants ; à valider avant toute régie réelle).
