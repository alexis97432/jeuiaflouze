# Tester PILE OU CRASH sur téléphone (jalon M1)

Proposition d'Alexis, à valider par Codex (propriétaire de `docs/`). Objet : vérifier sur de **vrais téléphones** ce que les tests automatiques ne prouvent pas. Les tests actuels tournent seulement dans Chromium émulé. Ce guide ne remplace pas le playtest de compréhension de `docs/VALIDATION.md` : il le précède.

Version à tester : la tête de la branche d'intégration `claude/youthful-mayer-n4f7oy`, à partir de `0add695`. Noter le SHA exact dans le compte rendu.

## 1. Préparer l'ordinateur (une fois)

Il faut un ordinateur avec Node.js ≥ 22.12 et git, sur le **même réseau Wi-Fi** que les téléphones.

```bash
git clone https://github.com/alexis97432/jeuiaflouze.git
```

```bash
cd jeuiaflouze
```

```bash
git checkout claude/youthful-mayer-n4f7oy
```

```bash
npm ci
```

## 2. Lancer le jeu sur le réseau local

```bash
git pull && npm ci && npm run build
```

```bash
npm run preview -- --host
```

La console affiche une ligne `Network: http://192.168.x.y:4173/`. Ouvrir **cette adresse** dans le navigateur du téléphone : Safari sur iPhone, Chrome sur Android.

- Si la page ne charge pas, le pare-feu de l'ordinateur bloque probablement le port 4173. Autoriser Node.js sur le réseau privé, ou essayer un autre réseau.
- `Ctrl+C` arrête le serveur. Rien n'est publié sur Internet dans ce mode.

**Limite importante du mode réseau local (http).** Les navigateurs réservent le partage natif et le presse-papiers aux pages sécurisées (https). En http local, « Défier un ami » affiche donc le lien à copier à la main. C'est le comportement de secours prévu, pas un bug. Le partage natif se teste à l'étape 5.

## 3. Parcours à vérifier sur chaque téléphone

Cocher chaque ligne et noter tout écart. Une capture d'écran ou une courte vidéo aide beaucoup.

| # | Action | Résultat attendu |
|---|---|---|
| 1 | Ouvrir l'adresse, en portrait | Accueil lisible, aucun défilement horizontal, bouton « Jouer » facile à atteindre au pouce |
| 2 | « Jouer », puis toucher l'écran pour poser des blocs | Une pose par toucher (jamais deux), pas de zoom ni de sélection de texte, rendu net (pas flou) |
| 3 | Jouer jusqu'au raté | Le bloc tombe, puis l'écran « Partie terminée » s'affiche avec le score. Toucher pendant la chute ne relance pas la partie |
| 4 | Fluidité | Mouvement régulier, sans saccade visible. Ressenti uniquement : noter le modèle de téléphone |
| 5 | Son activé (réglage par défaut) | Aucun son avant le premier toucher, puis des sons de pose, de parfait et de raté |
| 6 | À l'accueil, « Son : activé » → « coupé », puis jouer | Aucun son pendant la partie. Le réglage reste après rechargement de la page |
| 7 | Pendant une partie, passer à une autre appli puis revenir | Écran « Partie en pause » avec un seul message ; « Reprendre » continue sans saut ni pose fantôme |
| 8 | Recharger la page après une partie | « Record sur cet appareil » affiche le meilleur score |
| 9 | Navigation privée (Safari privé ou Chrome incognito) | Le jeu fonctionne. Le record peut indiquer « sauvegarde indisponible » : c'est le comportement prévu |
| 10 | Résultat → « Défier un ami » (en http local) | Lien affiché et sélectionné, copiable à la main |
| 11 | Ouvrir ce lien sur un **autre** téléphone | « Un ami vous défie : dépassez N étages », avec la même séquence. Le résultat compare au score annoncé, marqué « non vérifié » |
| 12 | Ouvrir un lien abîmé, par exemple `…:4173/?v=1&seed=abc&target=3` | Message « lien de défi … abîmé » et bouton « Nouvelle partie » |
| 13 | Tourner le téléphone en paysage pendant une partie | Pas de plantage ; partie jouable jusqu'au résultat. Limite connue (constatée en émulation Pixel 7 paysage) : zone de jeu réduite et large, écran de résultat à faire défiler pour voir « Accueil ». Le portrait reste la cible : noter le ressenti |
| 14 | Petit écran (iPhone SE ou équivalent) si disponible | Tout reste visible, boutons ≥ 44 px, texte lisible |
| 15 | Réglage système « Réduire les animations » activé | Pas de tremblement ni d'étincelles, le jeu reste lisible |

## 4. Appareils à couvrir

Le minimum pour clore M1 : un iPhone récent sous Safari et un Android milieu de gamme sous Chrome. Idéalement aussi un petit écran et un téléphone ancien ou d'entrée de gamme, qui révèlent les problèmes de fluidité et de mémoire.

## 5. Optionnel : partage natif en https

Le partage natif (#10 avec la feuille de partage du téléphone) demande une adresse https. Deux possibilités, au choix de l'équipe. Aucune n'est configurée dans le dépôt :

- **Tunnel https temporaire** vers `http://localhost:4173` (par exemple un tunnel Cloudflare ou ngrok). Attention : le jeu est **accessible publiquement** tant que le tunnel tourne. Le couper juste après le test et ne pas diffuser l'adresse.
- **Hébergement statique** du dossier `dist/`. C'est une décision de publication (PLAN M3) à prendre par l'équipe, pas un simple test.

En https, vérifier :
- partage réussi → « Défi envoyé. » ;
- partage annulé → « Partage annulé. », et rien n'est copié ;
- sur iPhone, si le partage échoue, la copie de secours fonctionne-t-elle (point m2 de la revue A1 de FLK) ?

## 6. Diagnostic si quelque chose casse

- **Android** : brancher en USB, activer le débogage USB, ouvrir `chrome://inspect` sur l'ordinateur pour voir la console du téléphone.
- **iPhone** : Réglages > Safari > Avancé > Inspecteur web, puis Safari sur un Mac (menu Développement).
- Joindre au compte rendu le message d'erreur, le modèle, la version du système et du navigateur.

## 7. Compte rendu à déposer

Créer `coordination/playtests/M1-appareils-<date>.md` dans une PR, ou transmettre le texte à Alexis. Utiliser ce modèle :

```
SHA testé :
Testeur·se :
Appareil / système / navigateur :
Mode : http local | https (préciser)
Résultats #1 à #15 : OK / écart (détail)
Fluidité ressentie :
Son :
Bugs (étapes pour reproduire) :
Captures / vidéos :
```

Rapporter seulement ce qui a été réellement observé. Une case non testée reste « non testé ». Ces vérifications techniques ne mesurent ni le plaisir de jeu ni la rétention : c'est le rôle du playtest de VALIDATION.md.
