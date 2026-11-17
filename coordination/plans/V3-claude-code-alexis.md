# Plan V3 — Claude Code Alexis (interface, progression, boutique, classement, services)

Base : intégration `31575e4` (V2 publiée, vérifiée en ligne). Mission utilisateur du 17 novembre 2026. Aucun plan V3 de FLK ni cadrage V3 de Codex n'était publié au moment d'écrire : ce plan **propose** des contrats, il ne les fige pas. Les interfaces consommées par FLK ne seront intégrées qu'après son accord écrit (PR ou fiche).

## Principes

- **Une partie gratuite normale ne dépend jamais d'un service.** Serveur, paiement, publicité absents : le jeu, la boutique en pièces, les récompenses et le passe gratuit marchent en local.
- **Trois états affichés sans ambiguïté** pour chaque fonction qui dépend d'un tiers : **Fonctionne**, **Démo** (adaptateur de test, développement seulement, bandeau « Mode démo »), **Indisponible** (aucun prestataire configuré). Aucun faux succès, aucun débit, aucun droit premium accordé comme achat vérifié.
- **Ce qui s'achète en argent réel vit sur un serveur** (droits, consommables, reçus, remboursements). `localStorage` ne garde que la progression gagnée en jouant, et un cache de lecture des droits serveur.
- **Menu pour un enfant de 8 ans** : mots courts, pictogramme + texte, une action principale par écran. Cela ne veut pas dire cibler les enfants avec la publicité ou les achats : ces écrans restent sobres, sans pression ni minuteur, et derrière une confirmation explicite. Le public et les âges doivent être définis avant toute activation réelle (C5 m5).
- Petites PR, propriétaires de fichiers respectés, FLK revoit mon code, je revois Codex, je ne fusionne pas mes PR.

## Séparation de l'architecture

| Couche | Emplacement (Alexis sauf mention) | Rôle |
|---|---|---|
| Client jouable | `src/game/**` (FLK), `src/app/**` | Jeu, menus, écrans |
| Progression locale | `src/app/economy.ts`, `progression.ts`, `shop.ts`, `pass.ts` | Ce qui se gagne en jouant (XP, pièces, objectifs, calendrier, achats en pièces, passe gratuit) |
| Services clients | `src/platform/services/` | Clients HTTP du serveur, avec repli local et erreurs visibles |
| Adaptateurs tiers | `src/platform/payments/`, `src/platform/ads/` | Interface + implémentation « aucun prestataire » + implémentation **Démo** (dev uniquement) |
| Serveur | `server/` | Classements, tickets de partie, rejeu, droits, reçus, consommables, remboursements |
| Données de démonstration | `server/demo/`, `src/platform/**/demo.ts` | Toujours étiquetées « démo », jamais présentées comme de vrais joueurs |

GitHub Pages ne sert que le client. Le serveur se lance localement (`npm run server:dev`) ; son hébergement réel est une dépendance externe documentée, pas simulée.

## Contrats proposés à FLK (à convenir avant intégration)

### 1. Bonus en partie (FLK : règles et rendu ; Alexis : jauge DOM et libellés)
Les bonus changent le déterminisme : **rulesVersion 2**, v1 conservée pour les anciens défis et le rejeu.
```ts
type BonusId = string; // ex. 'large', 'lent', 'aimant' — liste fermée exportée par FLK : BONUS_IDS
// ajouts à GameEvent (v2) :
| { type: 'bonus-charge'; bonus: BonusId; charge: number }      // 0..1, après chaque pose
| { type: 'bonus-start'; bonus: BonusId; durationTicks: number }
| { type: 'bonus-end'; bonus: BonusId }
```
Le shell affiche une jauge et un libellé court (« Bloc large », « Ralenti »…) depuis ces événements ; aucun calcul de règle côté shell.

### 2. Score, résultat et rejeu v2
```ts
type RunResultV2 = RunResult & { rulesVersion: 2; continues: 0 | 1; continueTicks: number[] };
replayRun(input) // accepte v1 et v2, rejette tout le reste ; même fonction côté serveur
```
Le classement standard n'accepte que `continues === 0`. Une partie avec reprise est marquée partout (résultat, carte, lien de défi).

### 3. Reprise (revive)
```ts
MountOptions.allowContinue?: boolean      // vrai seulement en Libre ; jamais en Tour du jour ni en défi classé
// au premier raté, si autorisé : GameEvent { type: 'continue-offer' } et la partie attend (pas d'onEnd)
GameHandle.continueRun(): void            // appelé par le shell APRÈS récompense confirmée (pub ou vie consommée)
GameHandle.declineContinue(): void        // fin normale, onEnd une seule fois
```
Une seule reprise par partie. Le shell gère pub/vie/annulation/retour d'arrière-plan et l'idempotence ; le moteur ne connaît ni pub ni vie.

### 4. Cosmétiques V3
Nouveaux `SkinId` (et éventuellement `ThemeId`) **que FLK accepte de livrer** :
- boutique en pièces : `graphite` (60), `nacre` (120), `holographique` (240) — C4/C5 ;
- catalogue en argent réel (Indisponible / Démo) : 2 à 3 apparences à proposer par FLK ;
- passe saisonnier : récompenses gratuites (au moins 3) et premium, à proposer par FLK.
Le shell filtre son catalogue avec `isSkinId` : un objet que le moteur ne sait pas dessiner n'est jamais vendu.

### 5. Carte de résultat (image)
```ts
renderResultCard(canvas, data: {
  score: number; perfectCount: number; longestStreak: number;
  pattern: ('perfect' | 'placed')[]; appearance: Appearance;
  mode: 'free' | 'challenge' | 'daily'; day?: string; continued: boolean;
}, options?) => boolean   // false si Canvas indisponible
```
Le shell convertit en fichier, partage (`navigator.share({ files })` si `canShare`), sinon téléchargement ou copie du lien de défi. Annulation jamais comptée comme succès.

## Lots Alexis (petites PR, revue FLK)

| Lot | Contenu | Dépend de |
|---|---|---|
| **V3-A1 Menu simplifié** | Accueil : grand « Jouer », « Défi du jour », barre « Boutique / Récompenses / Réglages » (pictogramme + texte). Écran Récompenses (objectifs, cadeau du jour, collection, passe). Réglages discrets. « Jouer » visible sans défiler en 320×568 et en paysage. | rien |
| **V3-A2 Boutique en pièces** | Catalogue, aperçu moteur, prix, confirmation, solde insuffisant, déjà possédé, achat atomique sous verrou (document v2), application réelle. | skins FLK (filtrés par `isSkinId`) |
| **V3-A3 Classement serveur** | `server/` : tickets de partie (seed émise par le serveur), soumission du rejeu, `replayRun`, meilleur score par joueur et version, global / hebdo / quotidien, pseudonymes, égalités, pagination, limites, quotas, idempotence. Écrans client : chargement, erreurs, hors ligne, mention « démo ». | `replayRun` FLK (v1 maintenant, v2 ensuite) |
| **V3-A4 Paiements et publicité** | Interfaces + « aucun prestataire » + Démo (dev). Serveur : droits, consommables (vies), reçus, remboursements, webhooks signés à brancher. Vies : consommation unique, jamais double. | rien pour l'architecture |
| **V3-A5 Passe saisonnier** | Saison finie (dates), paliers, XP de saison, piste gratuite récupérable une fois, piste premium séparée (Indisponible / Démo), aperçus. | récompenses FLK |
| **V3-A6 Reprise, bonus, carte** | Branchement des contrats 1, 2, 3, 5 ; gains calculés une seule fois à la fin définitive. | FLK |
| **V3-A7 Publication** | Après revues et CI : workflow Pages, vérification du SHA en ligne, compte rendu Fonctionnel / Démo / Indisponible. | tout |

Ordre : A1 et le contrat d'abord, puis A2 et A3/A4 en parallèle (indépendants du moteur), puis A5/A6 dès que FLK livre.

## Dépendances externes qui bloquent réellement une activation (aucune ne bloque la partie gratuite)

- **Hébergement du serveur** (classement, droits) : choix d'un hébergeur, d'une base et d'un domaine HTTPS. Sans lui, le classement en ligne est « Indisponible » sur le site publié et fonctionne en local de développement.
- **Prestataire de paiement** (web) et ses clés : sans lui, achats en argent réel « Indisponibles ».
- **Fournisseur de vidéos récompensées** compatible web mobile, consentement et règles d'âge : sans lui, pas de vidéo ; seules les vies possédées permettent une reprise.
- **Public et âges visés** : à décider avant toute publicité ou vente.
