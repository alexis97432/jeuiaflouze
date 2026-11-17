# Progression, économie et monétisation — étude et feuille de route

**Proposition Codex, à relire par Alexis et à commenter par FLK.** Aucun de ces systèmes n'est annoncé comme implémenté. Demande utilisateur : étudier/ajouter niveaux, passe cosmétique, effets de paliers, résurrection publicitaire, classement, achats de vies, skins, monnaie, exploits et calendrier quotidien. Cette demande étend la V2 ; elle prime sur l'ancienne exclusion générale de boutique de V2.md. La V2 visuelle déjà engagée continue.

## Décisions et priorités

| Idée utilisateur | Décision proposée | Premier lot |
|---|---|---|
| Niveaux | Niveaux de joueur par XP, sans modifier difficulté ou score ; des missions servent de petits défis de niveau | E1 après A3/A4 |
| Passe de combat cosmétique | Parcours saisonnier cosmétique ; version gratuite d'abord, offre premium seulement avec un compte/serveur et achats réels validés | E4 |
| Effets aux paliers | Confirme F3/F4 : scènes/retours aux hauteurs prévues dans V2, effets décoratifs bornés | V2 actuelle |
| Revive par publicité | Une reprise facultative en Libre, jamais dans une partie classée ou Tour du jour | E3 |
| Leaderboard normal | Vrai classement Libre sans revive, global et hebdomadaire ; quotidien séparé | E2 |
| Boutique de vies payantes | Consommables séparés de la monnaie gagnée ; même plafond d'une reprise, en Libre seulement ; paiement réel ultérieur | E3 |
| Skins de briques à acheter | Boutique de skins achetables en pièces, puis catalogue distinct en argent réel | E1 puis E3 |
| Monnaie du jeu | Une seule monnaie gagnable : Pièces. Pas de conversion implicite en argent | E1 |
| Exploits donnant monnaie | Récompense unique de chaque exploit et validation idempotente à la fin du run | E1 |
| Calendrier de récompenses | Cycle personnel de sept récompenses de connexion, sans remise à zéro en cas d'absence | E1 |

Priorité immédiate : rendre la partie et les décors intéressants (F3/F4), finir A3/A4, puis progression E1. Les méta-systèmes donnent des buts mais ne prouvent pas qu'une partie devient plus amusante. Demander au prochain essai quel système motive réellement à rejouer et ce qui encombre les menus.

## E1 — niveaux, pièces, exploits, boutique et calendrier local

Propriétaire : Alexis (src/app, platform, tests/app, styles). FLK revoit. Codex relit les arbitrages produit dans sa session active. Proposer E1 dans une PR séparée : ne pas injecter ces changements silencieusement dans A3a en cours.

### Niveaux et XP

Niveau du **joueur**, pas neuf modes de jeu présentés comme neuf niveaux. Proposition de départ [HYPOTHÈSE] : XP d'un run = min(score,50) + 2×min(perfectCount,10). Aucun XP pour abandon ou montage raté. Seuil total du niveau L = 20×(L−1)×L, L entre 1 et 10 ; niveau 2 à 40 XP. Une barre montre l'XP restant. Après niveau 10, garder le total d'XP sans afficher un niveau 11 non conçu. Titres locaux catalogués : niveau 2 « Apprenti », niveau 5 « Architecte », niveau 10 « Maître de la tour » ; aucun titre ne modifie les règles.

Le niveau n'accorde ni largeur, tolérance, vitesse, multiplicateur de score ou avantage de classement. Il sert de progression visible et pourra donner accès à des titres ou cosmétiques explicitement catalogués. Aucune vente d'XP à cette étape.

### Pièces et boutique

[HYPOTHÈSE] Récompense de partie = min(25, floor(score/3)+perfectCount) pièces ; minimum 0, pas de prime au simple lancement. Une partie ne rapporte qu'à sa fin définitive, une fois par runId. Aucun gain par simple ouverture d'URL de défi ou score déclaré dans target.

Les neuf objectifs V2 conservent leur récompense cosmétique déjà promise ; leur première réalisation ajoute 10 pièces chacun. Migration : les objectifs déjà accomplis lors d'E1 reçoivent chacun ce supplément **une seule fois**, dans une opération versionnée/idempotente. Ne pas retirer ou revendre un objet déjà débloqué. Les cosmétiques V2 à objectif restent obtenus par leur objectif ; la boutique vend une collection supplémentaire distincte.

Premier catalogue boutique [HYPOTHÈSE] : trois apparences additionnelles (Graphite 60 pièces, Nacré 120, Holographique 240). FLK doit confirmer leur faisabilité et visibilité avant fabrication. Les cinq skins d'objectifs V2 ne deviennent pas payants. Solde affiché, prix fixe, aperçu, confirmation claire puis sélection possible ; objet déjà possédé non rachetable. Aucun achat aléatoire ni remise factice. L'utilisateur peut tester l'aperçu sans perdre ses pièces.

Transaction locale unique : vérifier propriété/solde, débiter, accorder l'objet et sauvegarder un état cohérent. Pas d'état « débité mais non livré ». Si la persistance est indisponible, annoncer progression/boutique de session ; aucune promesse de sauvegarde cloud. Les pièces locales n'auront jamais valeur de reçu pour un futur achat réel ou classement.

### Calendrier

[HYPOTHÈSE] Cycle de sept **jours de connexion réclamés** : 5, 5, 5, 5, 5, 10, 15 pièces. Une réclamation par date UTC, date affichée ; au-delà du septième, cycle recommencé. Un jour absent ne remet rien à zéro et aucun rattrapage payant. Une seule réclamation même après double clic/recharge ; conserver la dernière date accordée, le numéro du cycle et l'index.

Pas d'obligation de popup à l'ouverture : badge discret et carte accessible. Aucune notification push demandée pour recevoir une récompense. Tant que local, l'horloge manipulable et la perte de sauvegarde sont des limites explicites ; pas de valeur commerciale attachée à ces récompenses. À terme, heure serveur pour l'économie en ligne.

### Acceptation E1

Migration depuis les records/préférences et objectifs A3 ; gains exactement une fois par run ; achat double clic/solde insuffisant/objet possédé/stockage en panne ; calendrier rechargement/minuit/absence/horloge reculée ; XP aux bornes et entier non négatif. Appliquer le catalogue via identifiants stables, pas des noms affichés. Ne pas créer une nouvelle monnaie ou supprimer des déblocages lors de la migration. Accueil : une action Jouer toujours dominante, boutique et calendrier secondaires.

## E2 — leaderboard réellement en ligne

Propriétaire : Alexis pour compte léger/identité pseudonyme, API, stockage serveur, quotas et UI ; FLK pour rejeu partagé et tests de charge bornés ; revue croisée conservée. Requiert une décision d'hébergement et un déploiement serveur concret : GitHub Pages ne stocke pas ce classement. Aucun tableau de faux joueurs en attendant.

Classement standard : **Libre sans reprise**, meilleur score de chaque joueur par rulesVersion, tableau global et hebdomadaire UTC. Tableau Tour du jour séparé par date/seed/version ; tentatives gratuites, meilleur résultat. Tri proposé : score décroissant, perfectCount décroissant, puis date serveur d'obtention la plus ancienne ; annoncer la règle. Ne pas mélanger les résultats de versions de règles différentes. Afficher « record local » tant qu'aucun score serveur n'a été validé.

Vérification serveur : run/challenge délivré et horodaté, seed/version connues, replay inputTicks borné, résultat recalculé, fin définitive, fréquence/payload/CPU limités, idempotence. Un replay valide ne prouve pas un humain ; documenter bots et abus résiduels. Pseudonyme modérable, règles de classement simples, pas de données privées dans les scores. En cas de réseau absent, jeu local maintenu et aucun succès d'envoi inventé.

## E3 — résurrection, pubs et achats réels

### Règle commune, à concevoir comme version des règles distincte

Maximum **une reprise par partie Libre** [HYPOTHÈSE]. À la première chute, choix Continuer (vidéo si disponible, ou vie possédée) / Terminer ; refus ou absence de vidéo termine normalement, sans empêcher de rejouer gratuitement. Une seconde chute termine définitivement. N'afficher une offre de vidéo que si un adaptateur réel dispose d'une publicité ; pas de faux bouton qui accorde une récompense sans vidéo.

Après reprise, la partie porte clairement la mention **avec reprise**, reste hors leaderboard et ne met pas à jour le record « sans reprise ». Les défis partagés annoncent cette distinction et ne font pas passer le score assisté pour un score classé. Tour du jour/classée : aucune reprise proposée.

Mécanique proposée à arbitrer par FLK : conserver la dernière base valide et le score déjà acquis, respawn d'un bloc de même largeur, compte à rebours de trois secondes sans mouvement ni pose pendant l'attente, puis reprise. Ne jamais utiliser un simple reset d'état du moteur v1 pour masquer la chute. Cela change fin/rejeu : concevoir rulesVersion 2 et un journal des événements de continuation, garder le rejeu v1 pour les anciens liens. Contrat snapshot/restauration à relire par Codex avant implémentation.

Le gain final (XP/pièces/objectifs) est calculé une seule fois à la fin définitive, pas à chaque écran de chute. Décider explicitement à E3 quels exploits exigent sans reprise ; conserver les validations déjà gagnées. Aucun double octroi pendant ad callback, rechargement ou reprise de réseau.

### Vidéos récompensées

Alexis : adaptateur fournisseur, disponibilité/erreurs et preuve serveur de complétion si le fournisseur la propose ; grant lié à un identifiant de run et d'opportunité unique, callback doublé/incomplet et annulation testés. Ne pas prétendre qu'une fin de timer JS valide une pub. FLK : état d'attente/reprise, aucun tick ni geste fantôme en retour de vidéo. Refuser d'engager le contexte de jeu avant confirmation de grant.

Choix du réseau après vérification de son support web mobile, des pays/publics, consentement approprié et conditions ; intégration SDK et comptes non disponibles aujourd'hui. Une PWA n'obtient pas automatiquement les capacités d'un SDK natif Android/iOS. Pas de promesse de revenus avant impressions réelles et eCPM observé.

### Vies et skins payants

Proposition : packs de 3 et 10 vies [HYPOTHÈSE], prix réels à définir avec les commissions/taxes du canal choisi, jamais des tarifs inventés dans un bouton d'achat. La boutique peut vendre un skin déterminé en achat permanent et des vies consommables ; aucun abonnement implicite. Une vie n'achète pas une nouvelle partie (rejouer reste gratuit), elle permet uniquement la reprise facultative prévue.

Le solde payé et les droits permanents résident sur un compte serveur, avec ledger des achats/grants/consommations/remboursements et clés d'idempotence. Valider les reçus ou webhooks signés du prestataire ; paiement échoué/annulé ne livre rien. Débiter une vie uniquement quand la reprise est effectivement accordée, avec compensation si l'opération échoue ; ne jamais perdre une vie parce qu'une page s'est fermée pendant une demande non confirmée.

Canal actuel = web mobile : paiement web pris en charge par un prestataire à choisir. Une application distribuée en boutique mobile demandera étude des règles applicables et intégration du système d'achat de cette boutique. Pas de secrets, numéros de carte, valeur d'achat ou preuve de paiement dans localStorage. Restaurer les droits permanents depuis le serveur et conserver les historiques des consommables ; ne pas promettre une restitution gratuite de vies déjà consommées.

## E4 — passe cosmétique

Ajouter après qu'un catalogue suffisant et une cadence de contenu existent, sans retarder V2/E1. Proposition de saison test [HYPOTHÈSE] : 28 jours UTC, 20 paliers, 100 XP de saison par palier, piste gratuite et piste premium clairement distinctes. Expliquer début/fin et conditions avant achat ; aucun achat actif sans calendrier, prix et inventaire de récompenses effectivement livrables.

Réutiliser l'XP gagnée par la partie sans la consommer, dans un compteur de saison distinct de l'XP de compte. Plafond au dernier palier, grants idempotents et récupération après reconnexion. Premium acheté en cours de saison accorde les récompenses premium des paliers déjà atteints une seule fois. Cosmétiques acquis restent possédés après la saison. Pas de boost de score ni de difficulté pour les acheteurs, pas de vente de niveaux au premier essai.

Pilote d'abord gratuit (même parcours, sans checkout), avec quelques récompenses véritablement réalisées. Avant offre premium : définir précisément les récompenses restantes, remboursement/fin de saison et inventaire serveur ; aucun passe payant avec promesses de contenu non fabriqué. Les nombres ci-dessus sont des hypothèses d'étude à tester, pas des engagements commerciaux.

## Répartition et consultation des trois IA

- **Codex C4** : cette étude, cohérence de l'économie et arbitrages produit après avis ; revue des modifications moteur FLK.
- **Alexis** : termine A3a/A3/A4 en cours, lit cette étude et fait la revue C4. Propose le découpage E1 en PR petites, avec estimation et risques de migration. Ne pas arrêter la V2 actuelle pour coder tous les services commerciaux.
- **FLK** : termine F3/F4, revoit Alexis ; donne un avis sur coût visuel des nouveaux skins, effets de paliers et surtout sur la faisabilité d'une reprise déterministe versionnée. Aucun revive silencieux introduit dans core v1.
- Chacun écrit son avis dans sa fiche et son rapport sur sa branche/PR ; on n'a pas encore reçu ces nouveaux avis au moment de la rédaction. Les lots E2–E4 restent conçus, pas autorisés à engager des frais ni à vendre quoi que ce soit. Ils seront rendus concrets par prestataires/serveur et revue avant activation.

Prochain test : finir une petite V2 plaisante, puis montrer E1 aux deux testeurs. Mesurer si les joueurs comprennent les récompenses, trouvent un achat cosmétique désirable et rejouent volontairement ; ne pas confondre achat ou réclamation quotidienne et intérêt pour la partie.

## Arbitrage après revue Alexis C4 (remplace les valeurs initiales non implémentées)

Revue lue : C4-claude-code-alexis.md sur `0148627` (PR #11). Défaut M1 confirmé : le calendrier initial rapportait 200 pièces contre 2 pièces par partie de référence. Valeurs corrigées ci-dessus : partie de référence de 10 étages et 2 parfaits = 5 pièces ; calendrier = 50 par cycle de sept connexions ; objectifs = 10 pièces chacun (90 au total).

Cible d'équilibrage préétablie : Holographique 240 pièces correspond à 48 parties de référence **sans** primes d'objectif/calendrier ; Graphite 12 parties, Nacré 24. Ce ne sont pas des prévisions de comportement humain. Exemples arithmétiques : 21 parties de référence donnent 105 pièces, plus 50 de calendrier = 155 ; les parties représentent environ 68 % de ce total, hors exploits. Une partie à 5 étages sans parfait donne 1 pièce, à 25 étages/6 parfaits donne 14. Retester l'accès au premier achat auprès des testeurs ; ne pas distribuer rétroactivement des récompenses de parties anciennes non observées.

Niveaux raccourcis à 10 avec titres à 2/5/10 : 40, 400 et 1800 XP. À 14 XP par partie de référence, environ 3, 29 et 129 parties. Hypothèses testables, aucun boost à acheter.

Accepte m2/m3 Alexis : XP, pièces, inventaire, calendrier et objectifs dans un **document unique versionné**, écrit une fois sous la clé existante `poc:meta:v1:progress`, schema `version: 2`. Migration avec grant stable `v2-objectives-backfill`, et supplément corrigé à 10 pièces par objectif déjà accompli. Garantir lecture d'un ancien document et répétition d'un chargement sans double grant ; pas de prétention d'antifraude contre import volontaire d'une ancienne sauvegarde locale.

Accepte m4 : date UTC antérieure ou égale à lastClaimDate refusée, aucune attribution de plusieurs dates par un seul passage, progression locale annoncée. Accepte m5 : avant activation E3/E4, déterminer public/âges et vérifier compatibilité des prestataires/consentements/distribution ; ne pas intégrer de ciblage publicitaire des mineurs. Catalogue visuel E1e toujours soumis à avis FLK, sans bloquer logique pure E1a–d.

Découpage E1a (migration), E1b (XP), E1c (pièces), E1d (calendrier), E1e (boutique) proposé par Alexis accepté. Priorité à terminer A3/A4 ; si la seule dépendance d'A4 est un rendu non livré, E1a et les fonctions pures peuvent être préparés sur une branche séparée, sans fusion avant revue FLK et sans interférer avec les fichiers d'intégration actifs.
