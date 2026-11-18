# Correctif — « Défier un ami » (Claude Code Alexis, après la V5)

Fait dans le cadre des autorisations V5 : PR fusionnée par son auteur, sans revue externe. **Les contrôles ci-dessous sont des auto-vérifications.**

## Problème

Après une partie, « Défier un ami » ne transmettait pas de lien sur téléphone. Deux causes dans `src/app/shell.ts` :

1. **Attente avant le partage.** Le bouton attendait la création de l'image du résultat avant d'appeler `navigator.share`. Safari et Chrome Android exigent que le partage parte pendant le geste de l'utilisateur. Si l'image était lente, le partage était refusé, puis la copie l'était aussi.
2. **Image jointe au lien.** Avec un fichier joint, Android et beaucoup de messageries n'envoient que l'image : le lien est perdu.

Reproduction : `navigator.share` simulé comme sur téléphone, refusé hors geste. Elle a été faite dans Chromium, pas sur un téléphone physique. Le partage recevait `title`, `text`, `url` **et** `files`, après l'attente de l'image.

## Correction

- **Lien prêt dès l'écran de résultat.** Il est calculé à l'affichage, avec la même partie, les mêmes règles (`v=1`, `2` ou `3`) et le score à battre en étages.
- **Partage natif immédiat.** « Défier un ami » appelle le partage natif tout de suite, sans aucune attente, avec **le lien seul** (titre, texte, lien). « Enregistrer l'image » reste disponible à part.
- **Nouveau bouton « Copier le lien ».** Il est toujours visible sous les actions principales, même en 320 × 568. La copie passe d'abord par le presse-papiers, puis par `execCommand('copy')` : ce secours sert aux navigateurs intégrés aux applications et aux pages sans permission.
- **Dernier recours.** Si aucune copie ne marche, le lien s'affiche, sélectionné, avec la consigne d'appui long.
- **Annulation.** Un partage annulé est reconnu même quand l'erreur n'hérite pas d'`Error` (anciens WebKit). Le message propose alors de copier le lien.

## Contrôles exécutés

- `npm run typecheck`, `npm test` (529 tests, dont `tests/platform/share.test.ts`) et `npm run build` : OK.
- `CI=1 npm run test:e2e` : 96 tests de l'application et 49 tests du moteur passent. Parmi eux :
  - **partage natif :** appelé pendant le geste, avec le lien seul ;
  - **chez l'ami :** il ouvre le lien et voit le bon score à battre, puis relève le défi ; le lien qu'il renvoie garde la même partie (`seed`) et les règles v3 ;
  - **« Copier le lien » sans presse-papiers :** le lien s'affiche et l'ancien défi `?v=2` garde ses règles ;
  - **mise en page :** pas de débordement en 320 × 568.

## Limites

- Aucun téléphone physique : le comportement d'Android, d'iOS et des messageries est simulé dans Chromium d'après leurs règles connues.
