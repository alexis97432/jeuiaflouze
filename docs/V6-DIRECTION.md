# V6 — « Stack or Crash » : matières vivantes et univers qui montent

Direction décidée par Claude Code Alexis, seul responsable de cette version.

## Intention

Ouvrir le jeu et voir tout de suite trois changements :
- **une tour faite de vraies matières**, avec relief, reflets, textures et mouvement ;
- **un décor qui raconte une ascension**, avec plusieurs plans et des découvertes ;
- **des menus évidents** : un écran par fonction et une barre d'onglets stable.

La technique reste Canvas 2D, enrichi de :
- **textures procédurales** générées une fois et gardées en cache ;
- **mappage dans l'espace du monde** : la matière continue d'une brique à l'autre ;
- **calques animés** ;
- **parallaxe sur plusieurs plans**.

Le WebGL et la 3D n'apporteraient rien de visible ici, au prix d'une architecture plus lourde sur mobile.

## Raretés

Il y a 4 niveaux. Chacun ajoute une vraie qualité de réalisation, pas seulement une bordure.

| Rareté | Matière | Mouvement | Pose et célébration |
|---|---|---|---|
| **Commun** | texture fine, volume (biseau, lèvre, ombre de contact), reflet | aucun | poussière standard |
| **Rare** | texture détaillée et éclairage propre | reflet qui glisse lentement | standard |
| **Épique** | matière à plusieurs couches | mouvement interne (coulées, impulsions, irisations) | particules propres à la pose |
| **Légendaire** | univers continu d'une brique à l'autre, avec plusieurs profondeurs (parallaxe interne) | vivant | pose signée, célébration au parfait, aura du bloc mobile, cadre de la carte de résultat |

Pour les univers, la rareté mesure la richesse de la scène : nombre de plans, animations et découvertes.

La rareté reste purement cosmétique : aucun effet sur le score, la collision ou le classement. Aucun tirage au hasard n'est vendu.

**Accessibilité :**
- En animations réduites, chaque objet a une belle version fixe.
- En qualité basse, les calques coûteux sont retirés, mais la matière reste reconnaissable.

## Catalogue

**Matières (19)**

| Rareté | Matières |
|---|---|
| Commun | Gomme, Strié, Bonbon, Graphite, **Bois** |
| Rare | Marbré, Céramique, Verre dépoli, Nacré, Pixel |
| Épique | **Circuit**, Holographique, Lave, Or, **Néon** |
| Légendaire | Galaxie, Cristal, **Aurore**, **Abysse** |

**Univers (5)**

| Rareté | Univers |
|---|---|
| Commun | Confiserie |
| Rare | Jardin |
| Épique | Orbital, **Récif** |
| Légendaire | **Cité néon** |

Les noms en gras sont nouveaux.

**Sources :**
- **Missions :** Strié, Bonbon, Marbré, Céramique, Verre ; univers Jardin et Orbital.
- **Boutique (pièces du jeu) :** Bois, Graphite, Nacré, Circuit, Holographique ; univers Récif.
- **Passe gratuit :** Pixel, Lave, Galaxie, Aurore.
- **Passe premium :** Or, Néon, Cristal, Abysse ; univers Cité néon.

Les objets déjà possédés le restent et reçoivent seulement leur rareté.

**Prix en pièces selon la rareté :**

| Rareté | Matière | Univers |
|---|---|---|
| Commun | 60 | — |
| Rare | 120 | — |
| Épique | 240 à 280 | 320 |

Les prix déjà affichés en V5 ne changent pas.

## Univers : 6 paliers

Les paliers sont à **0, 5, 10, 20, 35 et 50 étages**.

**Plans de la scène :**
- ciel et astres, qui bougent à peine ;
- silhouettes ancrées au sol, qui s'éloignent vers le bas pendant la montée ;
- couches de décor placées à des altitudes précises ;
- premier plan léger : particules, bulles, lucioles.

**Découvertes (easter eggs) :** à certains paliers, quelques apparitions discrètes et facultatives.

Le décor ne lit jamais la simulation, sauf la hauteur. Son hasard est cosmétique.

## Passe : 30 niveaux

Saison 1 : du 17 novembre 2026 au 28 février 2027 (environ 15 semaines).

**Rythme des étoiles :**
- Une partie de référence (10 étages, 2 parfaits) rapporte 14 étoiles.
- Le premier niveau arrive dès la première bonne partie (20 étoiles), puis le rythme s'allonge.
- Le niveau 30 demande 3 000 étoiles : environ 2 parties par jour sur la saison.

**Migration :** les 10 anciens paliers gardent leurs seuils et leurs récompenses. Ils deviennent les niveaux 1, 3, 5, …, 19, et leurs réclamations sont renumérotées une seule fois.

**Le Premium :**
- 2 matières légendaires (Cristal, Abysse) ;
- 2 épiques (Or, Néon) ;
- un univers légendaire (Cité néon) ;
- des pièces.

Il est préparé mais **n'est pas achetable** : aucun paiement réel n'est connecté. Le prix recommandé à l'ouverture est de 3,99 €, pour environ 5 objets exclusifs dont 3 légendaires.

## Menus

- **Barre d'onglets** permanente : Jouer, Boutique, Collection, Passe, Classement.
- **Réglages** dans la barre du haut.
- **Accueil** léger : Jouer, puis Défi du jour.
- **Passe** : la saison d'un côté ; missions et cadeau du jour de l'autre.
- **Après un achat ou une récupération** : une fenêtre montre l'objet animé, avec Équiper ou Plus tard.
