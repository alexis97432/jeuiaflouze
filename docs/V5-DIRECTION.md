# V5 — direction créative « Pop Choc »

Décidée et exécutée par Claude Code Alexis, seul, sur exception de l'utilisateur. Il n'y a pas de revue indépendante : les contrôles sont des auto-vérifications.

## Personnalité

Une tour-jouet espiègle dans un monde de bande dessinée.
- **Matière :** plastique brillant, contours d'encre et ombres franches.
- **Mouvement :** les blocs s'écrasent, rebondissent et se compriment en chaîne.
- **Typographie :** les réussites s'écrivent en onomatopées (« PILE ! », « CLAC ! », « CRASH ! »), qui surgissent, penchent et repartent.
- **Humour :** de brèves absurdités (un canard géant, un ovni voleur de chutes, un pigeon) clignent de l'œil sans jamais cacher la tour.

Le calme est la règle, l'explosion l'exception. Chaque effet exprime une action, un état ou une réussite : rien ne s'allume « pour décorer ».

## Échelle d'intensité d'une partie

| Moment | Ce qu'on voit | Son, vibration |
|---|---|---|
| Pose ordinaire | Écrasement bref du bloc, petite poussière côté coupe, morceau qui tombe en tournant | « toc » doux |
| Parfait | Onde de choc, **compression en chaîne** de la tour vers le bas, « PILE ! » | note montante, vibration courte |
| Série 3-4 | Liseré lumineux sur la tour qui s'intensifie, mots qui varient (« SUPER ! », « ENCORE ! ») | notes de plus en plus hautes |
| **Fièvre** (série de 5 parfaits) | Le monde bascule : ciel incandescent, rayons de BD qui tournent derrière la tour, braises, points ×2 tant que les parfaits continuent | arpège montant, puis « pschhh » à la fin |
| Palier | Grand titre du nouveau monde, décor qui change | fanfare courte |
| Boost de la jauge | Annonce d'un mot, transformation propre au boost, pastilles d'étages restants, fin visible | signature sonore par boost |
| Chute | « CRASH ! », bloc qui culbute, poussière, recul de caméra qui montre toute la tour | grondement court, vibration longue |
| Résultat | Le tampon du résultat prolonge la BD ; Rejouer reste le premier bouton | — |

## Boosts (règles v3)

La jauge Super garde ses gains (1 pour une pose, 2 pour un parfait, 3 dans une série). Pleine, elle donne le boost suivant du cycle **Ralenti → Aimant → Bouclier**. Un seul boost de jauge est actif à la fois ; la Fièvre peut s'y ajouter.

| Boost | Déclenchement | Effet de jeu | Signature visuelle | Fin |
|---|---|---|---|---|
| **Ralenti** | jauge pleine (1er du cycle) | vitesse × 3/5 pendant 5 étages | temps élastique : couleurs refroidies, sillage du bloc mobile, horloge fantôme | pastilles qui se vident, « tic-tac » |
| **Aimant** | jauge pleine (2e) | pendant 5 étages, tolérance du parfait 14 au lieu de 4 : les poses proches se collent | lignes de champ, zone d'aimantation **réelle** dessinée sur la base, « CLAC ! » à chaque collage | pastilles, déclic final |
| **Bouclier** | jauge pleine (3e) | pendant 6 étages, le premier raté est rattrapé : le bloc rebondit, la tour reste, l'étage repart après 0,75 s | bulle qui couvre le sommet de la tour, « BOING ! », éclats | bulle qui s'éteint, ou qui éclate en sauvant |
| **Fièvre** | 5 parfaits d'affilée | points × 2 tant que les poses restent parfaites | monde incandescent, rayons, braises, pulsation à chaque pose | « pschhh » au premier non-parfait |

**Interactions :**
- La Fièvre se combine avec n'importe quel boost : le Ralenti et l'Aimant aident à la prolonger.
- Un raté rattrapé par le Bouclier casse la série, donc la Fièvre.
- Une reprise (vie) remet la jauge à zéro, comme en v2.

**Absurdités :** elles sont seulement décoratives et ne modifient jamais le résultat.
- un canard géant traverse le ciel aux paliers ;
- un ovni emporte parfois le morceau coupé pendant la Fièvre ;
- un pigeon se pose sur un étage inférieur et s'envole au parfait suivant.

Leur variété vient d'un tirage cosmétique séparé, jamais du PRNG de la partie.

## Règles du jeu et compatibilité

- **Versions :** les nouvelles parties passent en **règles v3**. Les règles v1 et v2 restent identiques ; leurs rejeux et les liens de défi `?v=1` et `?v=2` se jouent avec leurs propres règles.
- **Classements et défis :** ils suivent la version de la partie.
- **Effets décoratifs :** ils ne lisent que l'état de la simulation et ne l'écrivent jamais. L'aimant montre la vraie zone de tolérance ; aucun effet ne décale visuellement la base ni le bloc mobile.

## Sobriété, accessibilité et mobile

- **Animations réduites :** pas de secousse, de compression, de rayons ni de particules. Il reste des annonces fixes, des teintes et des pastilles.
- **Mode Fluide :** deux fois moins de particules, sans rayons ni trame.
- **Lumière :** pas de flash stroboscopique ; secousses brèves et modérées.
- **Ressources :** particules en réserve bornée, tout est vidé en fin de partie et suspendu en arrière-plan.
- **Son :** il ne démarre qu'après un geste du joueur. Il reste doux et varie un peu pour ne pas lasser.
