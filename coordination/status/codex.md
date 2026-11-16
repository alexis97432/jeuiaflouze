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
