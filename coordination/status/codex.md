# Codex

## C0

- Livraison initiale : `c79f5c80246eb8264a204456b0236abfc33629ad`.
- Revue Alexis reçue dans PR #2 : CHANGES_REQUESTED (B1–B4 et précisions).
- État : corrections C0 encore à livrer et faire relire ; ne pas considérer les contrats figés.

## C1 — revue technique

- Branche : agent/codex/c1-review-f0.
- F0 / PR #1, SHA `3725541e2c5a49c35618f119895235f5157a5c97` : **PASS**, rapport coordination/reviews/F0-codex.md.
- F1 / PR #3, SHA `0896195ca4e10387b9dccfff8f6253f27c1ed873` : **CHANGES_REQUESTED**, rapport coordination/reviews/F1-codex.md. Appuis mal recalés après gel et harnais incompatible avec le scaffold A0.
- Vérifications : installation propre A0 ; A0+F0 typecheck/build et 94 tests verts ; compilation core sans DOM ; A0+F0+F1 : 114 tests livrés verts, test ciblé supplémentaire R1 rouge. Tests navigateur F1 bloqués avant lancement par dépendance absente puis __dirname en ESM (essai local temporaire).
- Aucun code de FLK ou Alexis modifié à distance ; aucun merge distant. Aucun téléphone réel testé.
- Revue de cette livraison Codex demandée à Alexis. SHA exact à prendre dans la PR de livraison.

## Décisions et dépendances

- Accepte les précisions des règles F0 décrites dans son rapport ; alignement du contrat à livrer en correction C0, relu par Alexis.
- Avis indépendants des deux Claude lus : tous deux signalent la faible différenciation du genre et proposent un défi quotidien. Garder le moteur pour le prototype ; comparer l'habillage quotidien au défi ami dans les tests humains, sans annoncer de gain statistique ni ajouter un deuxième moteur.
- Priorité mobile maintenue : latence tactile, portrait, petit écran, reprise après interruption, iOS/Android physiques à vérifier avant publication.
- Prochain pas : FLK corrige R1/R2 ; Codex traite les demandes C0 puis revoit le nouveau SHA F1 ; Alexis peut préparer URL/stockage/partage A1, sans attendre ni intégrer F1 non validé.
- Limite : aucune mesure joueur et aucun échange synchrone avec les deux sessions Claude ; seuls leurs livrables GitHub ont été lus.


## C0 corrigé et nouvelle revue F1

- Branche : agent/codex/c0-contracts-f1-review, basée sur intégration `ad50b4a`.
- F1 PR #3, SHA `b44d2a63ab5f2121eeb4e15acd55ae67bf3e7e59` : **PASS** après revue du diff, 128 tests unitaires, typecheck/build et 13 tests Chromium exécutés. Voir nouvelle revue en tête de F1-codex.md ; l'ancien verdict reste historique.
- C0 B1/B2/B3 : onEvent accepté, sound/reducedMotion à la création ; réglage entre les parties en M1, setter à chaud reporté ; erreurs de montage documentées.
- C0 B4 : A1.5 avant essai public, export local puis collecte optionnelle encadrée ; J1 non mesurable sans méthode appropriée. S1 : règle Wilson préétablie avec plafond d'échantillon, pas de feu vert automatique.
- Règles F0 alignées sur sa spécification exacte ; mineurs d'autonomie traités et ordre A0 → F0 → F1 → A1 explicité.
- **REVIEW_PENDING Alexis** pour cette nouvelle livraison documentaire. Les avis des deux propriétaires sont la base de l'arbitrage ; aucune implémentation de leur périmètre modifiée par Codex.
- Suite Alexis : revoir ce contrat, intégrer les dépendances approuvées, basculer A1 sur le vrai moteur et publier nouveau SHA. Suite FLK : revoir ce nouveau A1 et sa CI. A1 mock ne doit pas être fusionné comme prototype terminé.
- Après M1 : essai réel iOS/Android et playtest humain, pas encore effectués.

## C3 — direction V2 après essai humain

- Deux testeurs selon l’utilisateur : jeu fonctionnel, mais fade, daté et manque de contenu ; aucune mesure d’engagement fournie.
- Livraison : coordination/V2.md, proposition créative, contenu fini, interfaces à convenir, lots et critères de vérification. REVIEW_PENDING Alexis.
- Avis V2 FLK/Alexis explicitement demandés, non encore reçus ; aucun consensus revendiqué.
- Propriétaires : FLK F3/F4 rendu/sensations ; Alexis A3/A4 menus/objectifs/quotidien/progression/publication ; Codex arbitre et revoit FLK.
- La publication Pages autorisée par l’utilisateur est un instantané de 0add695 sur gh-pages, pas un déploiement automatique. V2 doit y être republiée seulement après revues, avec SHA de source traçable.
- Vérification : lecture UI/rendu A1 existants et skill game-ui-ux ; diff et liens documentaires. Pas de code de gameplay ni de mesure humaine inventée.

## C4 — étude des idées de progression et monétisation

- Demande utilisateur : niveaux, passe cosmétique, effets de paliers, pubs de reprise, classement, vies et skins payants, monnaie, exploits, calendrier. Étudiés dans coordination/ECONOMIE.md, pas implémentés.
- REVIEW_PENDING Alexis ; avis FLK demandé sur présentation et reprise déterministe. Pas de consensus revendiqué.
- A3a Alexis a déjà du code de progression : lecture de sa liste de changements et de son avis V2 ; E1 proposé après ses lots actuels, sans reprise à zéro ni édition de ses chemins.
- Arbitrage proposé : un niveau/XP purement cosmétique, une monnaie gagnable, E1 local, puis services vérifiés ; scores avec reprise distincts et hors classement sans reprise ; nouveau contrat/rulesVersion requis pour revive.
- Vérification documentaire : cohérence des récompenses/déblocages V2, transaction idempotente, migrations, disponibilité réelle des prestataires ; aucune facturation ou collecte distante ajoutée.

## Arbitrages C3/C4 après retour Alexis (C5)

- Revue Alexis C3 et C4 sur PR #11 lue ; M1 économie accepté et corrigé dans ECONOMIE : partie de référence =5 pièces, calendrier =50/sept connexions, objectifs =10 ; cible objet le plus cher =48 parties de référence hors primes.
- XP : niveaux 1..10, seuil 20*(L−1)*L et titres 2/5/10. Accepte document unique version2 et grant de migration idempotent proposés par Alexis.
- Contrat : daily accepté, date UTC au lancement, motif de partage deux catégories, heure du prochain changement locale, workflow Pages manuel autorisé par la demande de lien utilisateur antérieure.
- Découpage E1a–e accepté ; préparer les fonctions indépendantes sur branche distincte si A4 bloqué par le rendu. Pas de modification des fichiers de code des autres.
- REVIEW_PENDING Alexis pour ce lot documentaire C5. FLK conserve revues A3 et rendu F3 ; Codex a maintenant aussi la PR F3 #15 à revoir, non encore validée.

## C6 — revues F3/F4 terminées

- F3 #15 SHA `9e14f899f07609787dd1f0e287436562ecdf5bbb` : **PASS**. 209 unitaires, typecheck/build, 25 e2e +18 navigateur exécutés.
- F4 #19 SHA `22d0e6e491bb784c3f66c0c629aa8286512cd922` : **PASS après F3**. 220 unitaires, typecheck/build, 25 e2e et 25 navigateur ciblés exécutés ; le profilage coûteux de F3 non répété. Première tentative F4 partageant involontairement le serveur F3 invalidée, puis vérifiée avec serveur propre CI=1.
- Rapports : coordination/reviews/F3-codex.md et F4-codex.md. Contrat appearance et preview accepté et documenté. Livraison C6 **REVIEW_PENDING Alexis**.
- Prochain pas Alexis : relire C6, intégrer F3 puis F4 sur les SHA approuvés, brancher les apparences et faire revoir le nouveau SHA A4 par FLK. Ne pas confondre code fusionné et build Pages publié.
- E1 branché #20 garde **CHANGES_REQUESTED FLK sur 452ae7c**, défaut multi-onglets M2 ; pas de PASS Codex implicite. Attention : relire puis réécrire le localStorage ne garantit pas une transaction entre deux onglets concurrents ; convenir d'une sérialisation adéquate ou stratégie de fusion et tester le cas réellement concurrent, pas seulement des actions séquentielles.
- Aucun téléphone physique testé, pas de validation humaine de la nouvelle esthétique.

## C8 — F7/F9 validés, correction d'exposition F8b requise

- F7 #39 cf95c51 : PASS montage sur SHA exact, 343 tests livrés après contrôle isolé ; première suite concurrente avait un timeout de charge sur test v1. Détail transparent dans F7-codex.md.
- F9 #40 d8ba36f : PASS carte sur SHA exact, 355 unitaires/typecheck/build. Normalisation et bornes relues ; capture inspectée.
- F8b #41 1509f1e : CHANGES_REQUESTED R1 (carte publique perd le skin V3). 356 unitaires livrés et 38 tests navigateur ciblés passent mais une sonde supplémentaire reproduit la carte Graphite identique à Gomme. Ne pas annoncer tous les systèmes V3 terminés.
- Suite détaillée dans coordination/V3-INTEGRATION.md : correction F8b, déblocage drafts F6/F8, A6b carte réelle/catalogues, liens v2 sans conversion en v1, revue FLK et publication finale.
- C8 REVIEW_PENDING Alexis. Aucun code des deux autres modifié à distance, aucun merge ni publication dans cette livraison. Pas de téléphone physique testé.
