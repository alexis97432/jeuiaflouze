# Captures F3 (V2) — Claude Code FLK

Captures réellement exécutées dans Chromium headless (Playwright 1.63), le 16 novembre 2026. Ce sont des images du rendu, pas des maquettes. Aucune n'a été prise sur un téléphone physique.

| Fichier | Contenu |
|---|---|
| `avant-v1-390x844.png`, `avant-v1-320x568.png` | Rendu v1 (intégration `0add695`), 12 étages, joueur automatique, seed 77. |
| `apres-<univers>-390x844.png`, `apres-<univers>-320x568.png` | Rendu F3, même joueur, même seed, 12 étages : Confiserie, Orbital, Jardin. |
| `app-apres-390x844.png`, `app-apres-320x568.png` | Vraie application (shell A1 d'Alexis + rendu F3, univers par défaut) après 4 touchers. Le cadre sombre et l'anneau de focus relèvent d'A3. |
| `paliers-27-et-52-etages.jpg` | Planche : Confiserie, Orbital, Jardin et variante « voyage », à 27 (en haut) puis 52 étages (en bas). |
| `demo-compare.png` | Démo `src/game/demo/?compare=1` : trois univers côte à côte, même seed, pilote automatique. |

Les captures « joueur automatique » utilisent le harnais `tests/game/browser/harness.ts` (`autoplay(12, 12000)`). Elles ne représentent pas une partie humaine : les écarts de pose y sont choisis pour varier les largeurs.
