# V8 — économie : constat, recalibrage et simulations

**Retour de départ :** environ 20 minutes de jeu suffisaient pour acheter toute la boutique.

Ce document recense les sources de pièces, distingue un problème d'équilibrage d'un bug de double versement, puis justifie l'équilibre retenu. Les simulations sont des **estimations** faites avec les vraies fonctions de gain du jeu (`tests/app/economy-sim.ts`) ; ce ne sont pas des statistiques de vrais joueurs.

## 1. Sources de pièces (V7)

| Source | Règle V7 | Nature | Plafond |
|---|---|---|---|
| Partie | ⌊étages / 3⌋ + parfaits | répétable | 25 par partie |
| Objectifs (9) | 10 pièces chacun, plus un cosmétique | unique | 90 au total |
| Calendrier | 5, 5, 5, 5, 5, 10, 15 par réclamation, une par jour UTC | répétable chaque jour | 50 par cycle de 7 |
| Passe gratuit (30 niveaux) | 10 à 80 pièces par niveau, plus Pixel, Galaxie, Lave, Aurore | unique par saison | 1 025 pièces |
| Étoiles du passe | égales à l'XP d'une partie : min(étages, 50) + 2 × min(parfaits, 10) | répétable | 70 par partie, sans limite par jour |
| Prime de migration | 10 pièces par objectif déjà fait avant la V2 | unique (`v2-objectives-backfill`) | — |
| Vies | **dépense** : 30 pièces la vie | — | 3 vies |

**Prix V7 :** de 60 à 560 pièces ; 19 objets en pièces pour **4 360 pièces** au total. Une sélection du jour (3 matières, 1 univers, 2 musiques) coûtait environ 1 000 pièces.

## 2. Diagnostic : équilibrage, pas double versement

**Double versement (bug) : rien trouvé.** Points relus et testés :
- **Partie :** gains appliqués une seule fois par `runId` (200 dernières parties mémorisées), dans la même écriture que l'XP et les étoiles de saison.
- **Calendrier :** une réclamation par date UTC ; une date antérieure est refusée.
- **Passe :** un niveau réclamé une fois (`free:N`). « Tout récupérer » passe dans la même écriture.
- **Achat :** atomique sous le verrou entre onglets (Web Locks), avec relecture du stockage avant écriture. Le prix confirmé est vérifié au débit ; un objet possédé n'est jamais revendu.
- **Plusieurs onglets :** tests existants verts (réclamation dans A, partie dans B, bouton périmé, verrou tenu).

**Équilibrage (cause réelle).** Simulation du profil « régulier » avec les règles V7 : **693 pièces après 20 minutes de jeu**. Le constat de l'utilisateur est donc reproduit, et il a trois causes :
1. **Parties :** jusqu'à 25 pièces pour une minute de jeu.
2. **Passe :** ses étoiles suivent l'XP sans limite. Les 10 premiers niveaux, soit 165 pièces plus Pixel et Galaxie, tombent en une dizaine de parties ; le passe entier se finit en 2 à 11 jours selon le profil.
3. **Prix :** trop bas pour la taille du catalogue.

## 3. Équilibre V8

Gains et prix sont recalibrés ensemble. Il ne s'agit pas de multiplier les prix par dix : les gains changent de nature.

| Source | V8 | Pourquoi |
|---|---|---|
| Partie | 1 pièce dès 5 étages, +1 par 12 étages, +1 par 5 parfaits, au plus **6** | Le talent compte encore, sans que l'enchaînement de parties devienne la source principale |
| Prime du jour (nouvelle) | +10 pour les **3 premières parties** d'au moins 5 étages de chaque jour UTC | Chaque session apporte un progrès visible ; la prime ne se cumule pas en jouant plus |
| Objectifs | 10 pièces, inchangé | — |
| Calendrier | 10, 10, 10, 15, 15, 20, 40 (**120** par cycle) | Récompense le retour |
| Passe | Mêmes niveaux et récompenses, mais **au plus 80 étoiles de saison par jour** | Le passe se finit en 38 à 65 jours de jeu (V7 : 2 à 11 jours) ; l'XP du joueur n'est pas plafonnée |
| Niveaux de joueur | 30 niveaux au lieu de 10 (mêmes seuils pour les 10 premiers) | Une progression visible après les premières sessions |
| Vies | 30 pièces, inchangé | — |

**Prix par rareté :**

| Rareté | Matières | Univers | Musiques |
|---|---|---|---|
| Commun | 160 à 240 | 350 | 180 |
| Rare | 600 à 700 | 800 à 850 | 450 |
| Épique | 1 300 à 1 500 | 1 450 à 1 700 | 900 |
| Légendaire | 2 900 à 3 200 | 3 400 à 3 600 | 1 800 |

**Catalogue V8 en pièces :** 30 objets, dont 4 de Noël vendus seulement en saison, pour 38 500 pièces.

## 4. Profils simulés (hypothèses)

| Profil | Jeu | Hauteur moyenne | Parfaits | Parties par jour joué |
|---|---|---|---|---|
| Débutant | 15 min/jour, 4 jours/semaine | 9 étages (écart type 4) | 8 % des étages | ≈ 38 |
| Régulier | 25 min/jour, 6 jours/semaine | 20 étages (écart type 7) | 20 % | ≈ 40 |
| Performant | 40 min/jour, 7 jours/semaine | 38 étages (écart type 10) | 40 % | ≈ 40 |

**Durée d'une partie :** 1,3 s par étage, plus 12 s de lancement, chute et écran de résultat. Le calendrier est réclamé chaque jour joué, et le passe récupéré au fil de l'eau.

## 5. Résultats (cumul de pièces gagnées, sans achats)

| | Débutant | Régulier | Performant |
|---|---|---|---|
| Pièces après 20 min de jeu | V7 421 → **V8 256** | V7 693 → **V8 210** | V7 947 → **V8 246** |
| Pièces par jour joué (4 premières semaines) | V7 202 → **V8 122** | V7 470 → **V8 182** | V7 954 → **V8 293** |
| Boutique V7 entière avec l'économie V7 | jour 39 | jour 9 | jour 4 |
| V8 : premier commun | jour 2 | jour 1 | jour 1 |
| V8 : premier rare | jour 4 | jour 3 | jour 2 |
| V8 : épique (prix médian) | jour 22 | jour 9 | jour 5 |
| V8 : légendaire (prix médian) | jour 45 | jour 20 | jour 11 |
| V8 : moitié de la boutique | au-delà de 210 jours | jour 141 | jour 70 |
| V8 : boutique entière | au-delà de 210 jours | au-delà de 210 jours | jour 143 |
| Passe gratuit fini | V7 jour 11 → **V8 jour 65** | V7 jour 3 → **V8 jour 44** | V7 jour 2 → **V8 jour 38** |

Les jours sont des jours calendaires depuis le premier jour de jeu.

**Lecture :**
- **Premier achat :** il arrive dès la première ou la deuxième session.
- **Choix :** il y a de quoi choisir entre plusieurs objets communs et rares.
- **Moyen terme :** un rare prend quelques jours, un épique une à trois semaines.
- **Long terme :** les légendaires, les plus travaillés, demandent trois à six semaines pour un joueur régulier.
- **Noël :** du 20 novembre au 6 janvier, un joueur régulier gagne environ 7 500 pièces. Il peut donc s'offrir toute la collection de Noël (6 350 pièces) s'il épargne, ou une partie s'il achète autre chose.

**Garde-fous automatiques** (`tests/app/economy-sim.test.ts`) :
- le constat V7 reste reproduit (plus de 600 pièces en 20 minutes) ;
- pour chaque profil, un premier achat en 3 jours au plus, et aucun rare en 20 minutes ;
- pour le joueur régulier, un rare entre 3 et 10 jours et un légendaire entre 14 et 45 jours ;
- même le joueur performant met plus de 35 jours pour toute la boutique ;
- le passe se finit en 38 jours de jeu au moins.

## 6. Ce qui est préservé

- **Sauvegarde version 6 :** pièces, XP, possessions, réclamations et sélection gardées telles quelles.
  - Aucune remise à zéro, confiscation ni solde négatif.
  - Un joueur qui avait beaucoup de pièces les garde. Il achète aux nouveaux prix, sans rien perdre de ce qu'il possède.
- **Version future :** un onglet resté sur une version ancienne voit une version future et cesse d'écrire. Il ne peut pas effacer la prime du jour ni le plafond du passe.
- **Achat à cheval :** un achat confirmé au moment de la mise à jour, avec un prix différent, est refusé sans débit (vérification existante du prix confirmé).
- **Aucun avantage de jeu :** les cosmétiques ne changent jamais le score.

## Limites

- **Profils :** ce sont des hypothèses. Aucune donnée de vrais joueurs n'est collectée ; le rythme réel est à observer avec des testeurs.
- **Horloge :** la prime du jour et le plafond du passe suivent l'horloge de l'appareil, comme le calendrier. Les manipuler ne donne au plus que les primes d'autres jours ; un serveur serait nécessaire pour l'imposer.
