# Plan de validation et économie — Codex C0

## Ce que nous savons

Pas d'étude de marché chiffrée, de benchmark vérifié ni de joueurs observés à ce stade. Les seuils ci-dessous sont des **règles internes de décision**, pas des moyennes sectorielles ni une prévision. Une mécanique simple réduit le coût du test ; elle ne garantit pas l'acquisition, la rétention ou la rentabilité.

## Tests avant de construire plus

1. Test modéré avec 10 personnes extérieures au projet sur leur téléphone, sans expliquer les règles. Noter appareil, chargement, premier geste volontaire, compréhension, erreurs, rejouent-elles spontanément, verbatims. Objectif provisoire : 8/10 comprennent sans aide en 10 secondes et 6/10 rejouent volontairement trois fois. Échantillon qualitatif, non extrapolable.
2. Si ce signal est présent, essai public limité avec au moins 200 nouveaux joueurs valides sur plusieurs jours. Distinguer sources et cohortes ; mesurer les abandons de chargement aussi. Pas de trafic acheté sans budget explicite. Comparer médiane/p75 des durées, proportion ≥3 parties, retours J1 et partage suivi d'une arrivée.
3. Cibles provisoires de poursuite : ≥40 % des nouveaux joueurs terminent ≥3 parties, retour J1 ≥20 %, ≥5 % produisent une arrivée via défi attribuable. Ce sont des hypothèses ambitieuses ; publier numérateurs, dénominateurs et intervalles de confiance plutôt qu'un feu vert automatique. Retour J1 = joueurs revenus entre 24 h incluses et 48 h exclues / joueurs initiaux ayant toute cette fenêtre observable. Identifiant persistant uniquement avec cadre approprié ; sinon déclarer J1 non mesurable. Ne pas traiter les sessions comme des personnes.
4. En cas de compréhension faible, retoucher onboarding ; compréhension bonne mais rejouabilité faible, retoucher rythme/tolérance ; après deux variantes contrôlées toujours faibles, arrêter cette piste et tester un puzzle quotidien distinct. Bonne rétention mais faible diffusion : tester carte de résultat/texte du défi, pas ajouter du grind.

Chaque variante conserve rulesVersion, buildId, provenance, dates, exposition et taille de cohorte. Une seule variable majeure change. Consigner les données réelles et les limites dans la fiche Codex ; pas d'A/B test sous-dimensionné présenté comme significatif.

## Acquisition

Préparer trois clips réels du prototype : série parfaite, raté de justesse, duel sur seed identique. Ne publier qu'avec une version jouable et des médias dont nous détenons les droits. Mesurer clic → chargement → première partie → retour, pas seulement les vues. Le partage est optionnel et son lien ouvre directement le défi. Aucun faux adversaire ni faux record mondial.

## Monétisation après signal produit

M1 : gratuite, sans pub ni paiement. Ensuite tester d'abord des cosmétiques fixes et un achat de suppression de publicité ; aucune amélioration de score. Publicité uniquement entre parties avec fréquence plafonnée et comparaison de la rétention avant/après ; pas de publicité dans les premiers essais. Pas de vidéo récompensée permettant de ressusciter un score classé. Prix, fournisseur et fréquence restent à décider après test ; ne pas afficher d'achat factice fonctionnel.

Revenu estimé = impressions réellement servies / 1000 × eCPM net constaté + marge nette des achats. Comparer le revenu net par joueur au coût d'acquisition et aux coûts serveur, taxes/remboursements inclus selon le prestataire. Ne pas annoncer de LTV sans historique suffisant. Vérifier la compatibilité du réseau publicitaire avec le public visé avant intégration ; éviter le ciblage publicitaire des mineurs.

## Vérification M1

Alexis : `npm ci`, `npm run typecheck`, `npm test`, `npm run build`, `npm run test:e2e` deviennent les commandes communes via A0. Chaque commande doit exister et échouer en cas de défaut réel. FLK teste les frontières de chevauchement, parfaits, seed/version, cadence 30/60/120 Hz, input doublé, pause et rejeu. Alexis teste stockage bloqué/corrompu, URL invalide, partage absent/annulé, redémarrage sans fuite, clavier et mobile. Mesurer le poids gzip et un profil sur téléphone identifié ; objectifs initiaux : ≤500 Ko gzip pour le chargement principal et affichage fluide à 60 Hz sur l'appareil mesuré. Sans vrai appareil, marquer cette preuve manquante.

## Règle de décision préétablie (réponse C0 S1)

Le test de 200 joueurs est exploratoire. À cet effectif, calculer Wilson 95 % pour la proportion terminant au moins trois parties : si borne basse >30 %, poursuivre l'investigation (pas de lancement commercial automatique) ; si borne haute <30 %, retoucher le cœur ; sinon collecter jusqu'à 400 joueurs valides une seule fois. À 400, si l'intervalle traverse toujours 30 %, résultat inconclusif : retoucher/repenser avant expansion, pas de prolongations répétées jusqu'au résultat désiré. Reporter séparément J1 et arrivées attribuées, sans les fabriquer si collecte/consentement insuffisants. Les cibles 40/20/5 % restent des repères de conception ; elles ne remplacent pas cette règle. Préenregistrer variante, source et exclusions avant la collecte ; trafic interne, bots identifiés et doublons documentés sont exclus, pas les vrais abandons. Cette règle est un choix de gestion du prototype, pas une garantie statistique de succès commercial.

A1.5 selon CONTRACTS précède l'essai public : l'export local suffit au premier test modéré, pas au calcul du J1 public. Pour les 10 personnes, observer le jeu sans aide puis comparer les deux écrans de résultat dans des ordres alternés ; séparer intention déclarée de partage et partage/retour réellement observé.
