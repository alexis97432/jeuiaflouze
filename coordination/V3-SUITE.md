# V3 — passage de relais après revue Codex C7

État constaté le 17 novembre 2026. La version publiée est toujours la V2 31575e4. Les PR V3 ne signifient pas que leurs fonctions sont déjà dans le jeu public.

## Décisions qui lèvent l'attente

1. **Accord Alexis retrouvé**, pas à redemander à l'utilisateur : PR #25, SHA f71e69e, coordination/plans/V3-claude-code-alexis.md § Accord sur le plan FLK. Il accepte les interfaces de la PR #27 : jauge dans Canvas, annonces accessibles via événements, continueRun boolean, declineContinue, offre DOM, carte dérivée du vrai rejeu.
2. Codex accepte ces interfaces et les réglages du moteur comme expérience testable ; F6 #28 PASS sur e702748, F8 #30 PASS interne sur 57928d7. Rapports F6-codex.md et F8-codex.md. Les signatures à exporter viennent du plan FLK convenu, pas du type initial erroné RunResult & {rulesVersion:2} du plan Alexis ; utiliser une union discriminée v1|v2 et garder les anciens défis.
3. XP/pièces/objectifs comptés sur **height** en v2, jamais sur les points x2 ; leaderboard standard trié par points puis hauteur/parfaits et date serveur, partitionné par version. Pas de classement des parties avec reprise. Les records et liens v1 restent des étages, pas une conversion silencieuse en points.
4. Sans hébergeur/prestataire public : jeu gratuit fonctionnel, classement distant/paiements/vidéo Indisponibles ; simulation seulement en mode Démo explicite. Aucun besoin de carte bancaire, clé secrète ou choix d'hébergeur pour finir les interfaces et le gameplay V3. Aucun devis/abonnement/dépense à engager sans décision concrète.

## FLK — prochaine livraison nécessaire

- Lire la revue F6 ; renforcer si souhaité la comparaison de bestPerfectStreak/bonusCount, ou expliciter le résultat normalisé obligatoire. Revue du nouveau SHA si code modifié.
- **F7** : montage rules v2, jauge, effets bonus, points/hauteur, attente de décision après chute, continueRun/declineContinue, compte à rebours, nettoyage/pause/visibilité et anciens défis v1. allowContinue=false doit terminer normalement sans bloquer daily/challenge. Tests d'un double callback et du geste qui traverse l'offre/reprise.
- **F8 exposition** : accord déjà présent ; exporter les huit identifiants/apparences et coordonner les consommateurs Alexis. PR/commit distinct testable, nouveau SHA à revoir, pas de modification unilatérale de ses fichiers.
- **F9** : summarizeRun/renderResultCard suivant interface acceptée. Dériver du rejeu normalisé, pas des compteurs déclarés ; borner taille/mémoire du motif/de la tour et gérer la partie v1, v2, avec reprise. Aucun classement/paiement dans le renderer.
- Effectuer aussi les revues Alexis disponibles, notamment A5 #35 si non déjà revue. Ne pas déclarer sa mission terminée alors que F7/F9 ne sont pas livrés.

## Alexis — suite sans attendre les services commerciaux

- Relire cette livraison Codex C7 ; elle relève de ton cycle de revue.
- Les accords partagés sont actés. Préparer A6 sur une branche : adaptateur des résultats union, gains finaux uniques sur hauteur, mode de record/score explicite, partage de fichier avec secours, offre de reprise accessible. Brancher au vrai F7 dès sa livraison revue Codex, pas à un mock présenté comme fini.
- L'autorisation de reprise vient d'une vie réellement possédée ou d'un grant vidéo confirmé par l'adaptateur approprié ; repli indisponible en production sans fournisseur. Ne jamais transformer une publicité absente en récompense gratuite présentée comme vidéo vue.
- Réconcilier les catalogues avec le F8 exposé et les récompenses du passe. Migration V2→sauvegarde3 doit préserver les anciens objets et empêcher un ancien onglet d'écraser la nouvelle sauvegarde.
- Respecter l'ordre des dépendances et PASS sur SHA exact ; FLK fusionne les PR Alexis, Alexis les PR FLK après PASS Codex. Pas d'auto-fusion.
- Après A6 réel, revues et CI : publier Pages et rapport Fonctionnel / Démo / Indisponible avec SHA réellement servi. L'utilisateur a déjà demandé cette publication ; ne pas demander une nouvelle permission pour republier le client validé dans ce périmètre.

## Fin de session

Les agents doivent relire les PR/rapports disponibles, pas attendre un résumé de l'utilisateur. Une session arrêtée ne se réveille pas par ce fichier : si nécessaire, une unique relance « lis la dernière PR Codex C7 et poursuis ton rôle » suffit. Aucune veille permanente promise par Codex après sa réponse finale.
