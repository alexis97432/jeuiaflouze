# Audit V3 → V4 (Claude Code Alexis, 17 novembre 2026)

**Base auditée :** `02037e8`, la version servie sur https://alexis97432.github.io/jeuiaflouze/ (`source-commit.txt` vérifié).

**PR ouvertes au démarrage :** #9, #11, #17, #24, #25, #27, #31, #36, #38, #43, #44 et #46. Elles ne contiennent que de la coordination (revues, plans, statuts) : aucun code non intégré.

**Méthode :**
- lecture du code intégré ;
- tests existants (unitaires, e2e, navigateur) ;
- parcours automatisé de tous les écrans dans Chromium à 390×844 et à 320×568, avec boutons visibles, débordement horizontal et erreurs console relevés. Captures dans `coordination/captures/v4-avant/`.

C'est une **auto-vérification** : la V4 est réalisée sans revue externe, sur décision de l'utilisateur.

## Inventaire des fonctions (état V3)

| Fonction | Parcours | État réel |
|---|---|---|
| Partie libre (règles v2 : jauge Super, Ralenti, ×2, points et hauteur) | Accueil → Jouer → partie → résultat | Fonctionnel |
| Défi du jour (même séquence pour tous, une par jour UTC) | Accueil → Défi du jour | Fonctionnel |
| Défi entre amis (`?v=1` ou `?v=2&seed=…&target=…`) | Résultat → Défier un ami → lien → Relever le défi | Fonctionnel ; la cible est déclarée, non vérifiée |
| Reprise après la première chute | Offre « Utiliser une vie » / « Vidéo indisponible » / « Terminer » | Vie : fonctionnel (local). Vidéo : **indisponible**, aucune régie |
| Vies | Boutique, 30 pièces, 5 au maximum ; une seule retirée par reprise ; rendue si la reprise échoue | Fonctionnel (local) |
| Étoiles (XP), niveaux 1 à 10, pièces | Gains en fin de partie, sur la hauteur, une seule fois par partie | Fonctionnel (local) |
| Missions (objectifs) | Récompenses → liste ; récompense débloquée en partie | Fonctionnel |
| Cadeau du jour (calendrier de 7 jours) | Récompenses → Prendre | Fonctionnel |
| Boutique en pièces (Graphite, Nacré, Holographique) | Boutique → Acheter → confirmer → Mettre | Fonctionnel |
| Collection (3 univers, 12 apparences dont 6 obtenables en V3, 2 badges) | Récompenses → Ma collection → Choisir | Fonctionnel |
| Passe de saison 1 | Récompenses → Voir le passe → Prendre | Piste gratuite fonctionnelle ; premium **indisponible** |
| Classement mondial, semaine, jour | Classement | **Indisponible** en ligne : aucun serveur hébergé. Démo en local seulement (`npm run server:dev`) |
| Carte de résultat et partage | Résultat → Défier un ami / Enregistrer l'image | Fonctionnel (fichier ou lien, copie, lien manuel, téléchargement ou appui long) |
| Achats en argent réel, vidéos récompensées | — | **Indisponibles** (aucun fournisseur), sans faux succès |
| Réglages | Réglages | **Son seulement** (activé ou coupé) |
| Sauvegardes | `poc:v1:*` (record, préférences), `poc:meta:v1:*` (progression v3, records du jour, joueur) | Fonctionnel : migration V2 → v3, verrou entre onglets, onglet ancien en lecture seule |

## Défauts et manques relevés en V3

| # | Constat | Correction V4 |
|---|---|---|
| D1 | Les réglages ne proposent que le son : pas de thème, de volume, de vibrations, d'animations ni d'effets | Vrai menu Réglages, persistant |
| D2 | Pas de bouton Pause : la pause n'existe que quand l'onglet est caché, et on ne peut pas quitter une partie | Bouton Pause (Reprendre, Quitter) |
| D3 | « Tour du jour » en partie et au résultat, mais « Défi du jour » à l'accueil ; « défi » désigne aussi les objectifs et les défis entre amis | « Défi du jour » partout ; les objectifs deviennent des « Missions » |
| D4 | Textes techniques dans les parcours : « (UTC) », dates `2026-11-17`, « Score local, non vérifié », « non vérifié » pour un ami, « serveur » au classement | Textes simples, dates en toutes lettres |
| D5 | Vouvoiement et tutoiement mélangés (invitation, lien invalide, libellé du canvas, « Touchez pour reprendre », « Copiez le lien ») | Tutoiement partout |
| D6 | Bouton « ← Retour » dans la collection, « Retour » ailleurs | Un seul composant d'en-tête |
| D7 | Le bouton retour du téléphone fait quitter le jeu depuis n'importe quel sous-écran | Historique : retour vers l'accueil ; en partie, retour = pause |
| D8 | Collection et passe très longs (environ 1 800 px de défilement à 390 px) | Grilles plus compactes, passe en piste |
| D9 | Pas de thème sombre ; `theme-color` fixe | Thème clair, sombre ou automatique, contrastes vérifiés |
| D10 | Confirmation d'achat dans la carte, peu visible | Fenêtre de confirmation |
| D11 | Pictogrammes en emoji : rendu variable selon l'appareil | Icônes SVG cohérentes |

Aucune erreur console ni aucun débordement horizontal relevés en V3 sur les écrans parcourus.

## Après V4

La matrice des parcours après la V4 est dans `docs/V4.md`.
