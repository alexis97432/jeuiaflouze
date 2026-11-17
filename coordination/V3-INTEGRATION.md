# Suite V3 après revue C8 de Codex

17 novembre 2026. Les messages « terminé » des sessions désignent des lots livrés, pas la publication V3. La V2 reste publiée tant que l'intégration et le workflow Pages n'ont pas abouti.

## FLK

1. F7 #39 cf95c51 et F9 #40 d8ba36f ont leur PASS Codex dans les rapports dédiés.
2. F8b #41 1509f1e a CHANGES_REQUESTED : la carte publique ignore les skins V3 ; corriger R1 dans F8b-codex.md, tests puis nouveau SHA. Ne pas modifier la branche d'Alexis.
3. Sortir F6 #28 et F8 #30 du brouillon si leurs SHA sont toujours ceux approuvés par C7. Alexis pourra les intégrer puis F7/F9 après ses revues documentaires ; ne pas auto-fusionner le code FLK.
4. Revoir A6b #42 sur sa tête actuelle après le PASS F7 ; demander que les liens partagés d'une partie v2 gardent cette version (ancien v1 conservé), pas un défi v1 avec une seed v2 et une simple note « comparable ». Vérifier séparément skin acheté/choisi et skin de la carte après correction.
5. Revoir les nouvelles PR d'Alexis et intégrer celles approuvées dans l'ordre des dépendances avec vérification des derniers SHA/CI. Pas de fusion automatique d'un ancien PASS portant sur un autre commit.

## Alexis

1. Relire la livraison C8 et les rapports Codex. Intégrer le code FLK approuvé en ordre : F6/F8 → F7 → F9 ; F8b attend son correctif et nouveau PASS. Les contrats ne requièrent plus un accord utilisateur supplémentaire.
2. Continuer A6b #42 : brancher le vrai renderResultCard dès F9 disponible (actuellement carte encore absente dans son parcours), élargir les catalogues/sélection/sauvegarde à AnySkinId/isAnySkinId en conservant les anciens déblocages, et afficher les nouvelles récompenses effectivement utilisables.
3. Corriger le partage de défi : écrire/lire rulesVersion 1 ou 2, transmettre celle de la partie source et séparer clairement cible hauteur et points selon le contrat choisi. Ne pas dégrader un run v2 en run v1 : le Ralenti change la trajectoire temporelle et la difficulté, donc la même seed ne suffit pas. Garder tous les vieux liens v1. Partie avec reprise identifiée et hors classement standard, sans comparaison trompeuse.
4. Continuer à distinguer Fonctionnel / Démo / Indisponible. Pas de pub ou paiement prétendument réel si prestataire absent. Pas de données de classement fictives présentées comme vraies. Cela ne bloque pas le jeu gratuit, les pièces et le passe gratuit.
5. Après revue FLK du shell final et CI de l'arbre intégré, publier via le workflow Pages autorisé, vérifier source-commit.txt et fournir le lien au testeur. Aucun nouveau « confirme la publication » requis pour ce même périmètre demandé.

## Codex

Revoir le correctif F8b et les nouvelles modifications de FLK pendant son prochain tour actif. Aucun pilotage permanent des sessions externes après sa réponse finale. Les rapports C8 sont eux-mêmes à relire par Alexis ; ne pas les assimiler à une auto-fusion.
