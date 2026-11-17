# Revue E1 branché, SHA `5166199` — Claude Code FLK

- **Tâche :** [alexis97432/jeuiaflouze#20](https://github.com/alexis97432/jeuiaflouze/pull/20) · **Auteur :** claude-code-alexis · **Reviewer :** claude-code-flk
- **SHA revu :** `51661997bc2ee5adf59114cd0c8ad70bd9fc0c83`, vérifié comme tête de la PR sur GitHub le 17 novembre 2026 avant la revue. Delta depuis ma revue précédente (`452ae7c`) : commits `48c7f66` et `5166199` (`shell.ts`, `storage.ts`, `tests/app/shell.test.ts`, `tests/e2e/a1.spec.ts`).

## Commandes et résultats réels (`npm ci` propre, Node 22.23.4)

| Commande | Résultat |
|---|---|
| `npm run typecheck` | exit 0 |
| `npm test` | 15 fichiers, **259/259** (UTC+14) |
| `npm run build` | JS 15,52 Ko gzip |
| `CI=1 npm run test:e2e` | e2e **47** réussis, 25 ignorés par profil ; navigateur F1 13/13 |

## M2 (deux onglets) : corrigé et protégé

- **Relecture avant chaque modification** : `updateDoc` relit le document stocké, applique la modification, puis écrit le document complet. Les trois chemins y passent : réclamation, choix d'apparence, fin de partie.
- **Le magasin relit vraiment `localStorage`** : `createJsonStore` ne privilégie plus son miroir mémoire, qui ne sert plus que si le stockage est absent, illisible ou n'a pas reçu la dernière écriture. Sans ce changement, la relecture aurait relu sa propre copie.
- **Exclusion entre onglets par Web Locks** (`PROGRESS_LOCK`), avec repli explicite sans verrou. Le record, la progression et le record du jour d'une fin de partie passent sous le même verrou. L'événement `storage` rafraîchit l'accueil.
- **Tests** : 5 unitaires (onglets A et B, bouton « Récupérer » resté affiché, événement `storage`, onglet qui tient le verrou, fin de partie sous verrou) et 2 e2e à deux onglets du même navigateur, dont un sous le vrai Web Locks.
- **Mes mutations**, dans un fichier temporaire supprimé :
  - sans la relecture dans `updateDoc` : `npm test` échoue (2 tests) ;
  - avec le miroir mémoire de nouveau prioritaire : `npm test` échoue (1 test).

## m1 (titre au passage de niveau) : corrigé

Le titre n'est annoncé que s'il est nouveau (`LEVEL_TITLES[to]`), et un test le couvre.

## Remarque restante (information)

Web Locks n'existe que dans un contexte sécurisé (HTTPS ou `localhost`). GitHub Pages est en HTTPS. Ailleurs, le repli « relecture sans exclusion » s'applique, ce qui reste bien meilleur que l'état initial.

## Verdict

**PASS** sur `51661997bc2ee5adf59114cd0c8ad70bd9fc0c83`. Il remplace le CHANGES_REQUESTED de `452ae7c`. À intégrer après #12, #14 et #18. Ce PASS ne couvre aucun SHA ultérieur.

---

## Historique : revue de `452ae7c`

### Revue E1 branché, SHA `452ae7c` — Claude Code FLK

- **Tâche :** branchement d'E1 au shell, [alexis97432/jeuiaflouze#20](https://github.com/alexis97432/jeuiaflouze/pull/20) (brouillon, empilée sur #18, #14 et #12)
- **Auteur :** claude-code-alexis · **Reviewer :** claude-code-flk
- **SHA revu :** `452ae7c30c60c6c992e75f9715c516fbd2bde4ed`, sur un worktree détaché. Diff propre : `c574990..452ae7c` (`shell.ts`, `progression.ts`, `styles.css`, tests, captures).
- **Périmètre lu :** diff complet de `shell.ts` et `progression.ts`, nouveaux tests unitaires et e2e (titres et assertions), captures `coordination/captures/e1/`, description de la PR.

## Commandes et résultats réels (`npm ci` propre, Node 22.23.4)

| Commande | Résultat |
|---|---|
| `npm run typecheck` | exit 0 |
| `npm test` | 15 fichiers, **253/253** (UTC+14) |
| `npm run build` | JS 15,26 Ko gzip |
| `CI=1 npm run test:e2e` | e2e **43** réussis, 23 ignorés par profil ; navigateur F1 13/13 |

## M1 de ma revue E1 : traité

- **Une seule lecture** (`readProgressDoc`) et **un seul chemin d'écriture** (`saveDoc`, document complet). C'est vérifié : `grep writeProgress src/app` ne trouve qu'une occurrence. Les trois chemins (fin de partie, choix d'apparence, calendrier) passent par `saveDoc`. `selectAppearance` devient générique et ne perd plus de champ.
- Le **test demandé** existe. Il fait passer les trois chemins, recrée le shell sur le même stockage sérialisé en JSON, vérifie que `version`, `xp`, `coins`, le calendrier et la sélection survivent, et que la simple lecture ne réécrit rien. Il est complété par un e2e avec un vrai rechargement de page.
- Une version future est lue sans être réécrite, et l'interface l'annonce.

## Défauts

**M2 — majeur, à corriger avant intégration (`src/app/shell.ts`, `saveDoc` et l'état `progress` en mémoire).** Chaque shell lit le document **une fois au chargement**, puis réécrit en entier sa copie en mémoire. Avec deux onglets ouverts sur le jeu (cas courant sur téléphone, où un lien de défi rouvre un onglet), **le dernier qui écrit efface ce que l'autre a gagné**.

Sonde exécutée avec le vrai `createMetaStore` sur un même stockage, en reproduisant le comportement du shell (chaque onglet garde son document) :
1. les onglets A et B sont ouverts ;
2. A récupère la récompense du jour (+5) et écrit ;
3. B termine une partie et écrit.

Résultat : `{ coins: 15, lastClaim: null }`. La récompense de A est **perdue**, et `claimCalendar` accepte de nouveau la réclamation **du même jour**. L'XP et les pièces d'une partie se perdent de la même façon dans l'autre sens. Avec la boutique (E1e), un achat pourrait disparaître de la même manière.

Correction suggérée, en quelques lignes :
- dans chaque action qui modifie la progression (fin de partie, choix, réclamation), **relire le document stocké juste avant** (`readProgressDoc(meta.readProgress())`), appliquer la modification, puis écrire. Tout est synchrone : il n'y a pas d'entrelacement possible dans un même onglet ;
- en complément, écouter l'événement `storage` pour rafraîchir l'accueil quand un autre onglet écrit ;
- ajouter un test unitaire avec deux shells sur le même stockage (réclamation dans A, partie dans B) : la réclamation et les gains de B doivent survivre, et une seconde réclamation le même jour doit être refusée.

**m1 — mineur (`renderResult`, `level-up`).** Le message « Niveau N atteint : <titre> ! » affiche le titre le plus élevé déjà possédé, par exemple « Niveau 3 atteint : Apprenti ! ». Il laisse croire que le titre est nouveau. Suggestion : n'afficher le titre que si le niveau atteint en a un (2, 5, 10).

**i1 — observation produit, à suivre en playtest.** L'accueil empile désormais profil, Tour du jour et objectifs. « Jouer » reste l'action dominante, mais en 320×568 il faut défiler pour atteindre les objectifs (capture `e1-accueil-320x568.png`). C'est le risque « tableau de bord » signalé par le brief et par Alexis lui-même. Une question pour les deux testeurs : qu'ont-ils lu sur l'accueil avant de jouer ?

## Points solides

- M1 est traité avec le bon test, au bon niveau : vrai stockage, aller-retour JSON, vrai rechargement en e2e.
- La version future est protégée, et l'interface le dit honnêtement.
- La mention « Progression locale, sur cet appareil » est affichée. Aucune boutique n'est activée avant les visuels F4.
- Le résultat montre XP et pièces gagnés, ce qui donne une raison concrète de rejouer.

## Verdict

**CHANGES_REQUESTED** sur `452ae7c30c60c6c992e75f9715c516fbd2bde4ed`, à cause de M2 (perte de progression et double réclamation avec deux onglets). Le reste est prêt. Je revois le nouveau SHA dès qu'il sera publié.
