# Claude Code Alexis

## Tâches

| Tâche | État | Branche | SHA / PR | Tests |
|---|---|---|---|---|
| Revue C0 (Codex) | CHANGES_REQUESTED, en attente du nouveau SHA C0 | a0-shell | revue de `c79f5c8`, coordination/reviews/C0-claude-code-alexis.md | lecture + calculs |
| A0 squelette | **PASS FLK** sur `e84647e` ; fusion par FLK (AGENTS) | agent/claude-code-alexis/a0-shell | [PR #2](https://github.com/alexis97432/jeuiaflouze/pull/2) | CI GitHub verte |
| A1 intégration | **Préparation livrée, moteur encore simulé** ; REVIEW_PENDING (FLK) | agent/claude-code-alexis/a1-integration | PR A1 (brouillon) | voir ci-dessous |
| Revue C1 (Codex, PR #4) | PASS sur `f18e5d4` | a1-integration | coordination/reviews/C1-claude-code-alexis.md | reproductions R1/R2 et F0 sans DOM |
| Revue protocole autonomie (Codex, PR #5) | PASS sur `df88ba5`, mineurs | a1-integration | coordination/reviews/AUTONOMIE-claude-code-alexis.md | lecture + commande d'exemple |

## A1 — contenu livré (moteur simulé)

- URL de défi `?v=1&seed&target` à validation stricte (`src/app/challenge-url.ts`) : entiers décimaux sans signe, sans zéro initial, sans espace ; paramètres répétés refusés ; paramètres étrangers ignorés ; message par cause ; aucun `innerHTML`.
- Sauvegarde locale `poc:v1:` (`src/platform/storage.ts`) : record, préférence son, 10 derniers résultats. Stockage absent, bloqué, plein ou corrompu : repli mémoire, le jeu continue, et l'interface affiche « sauvegarde indisponible ».
- Partage (`src/platform/share.ts`) : Web Share, copie de secours, lien affiché à copier à la main en dernier recours. Une annulation n'est pas un succès et ne déclenche pas de copie silencieuse.
- Shell : défi rejoué sur la même seed, comparaison au score annoncé (« non vérifié »), nouveau record, son mémorisé et transmis au moteur, erreur de démarrage récupérable, `first_placement` unique par partie.
- **Délai de garde de 500 ms sur les boutons du résultat**, défaut découvert en essai avec le vrai moteur : un Espace ou un toucher au moment du raté relançait la partie par accident.
- Remarques de la revue A0 de FLK : m1 (e2e sans supposer `onEnd` synchrone), m2 (CI sur push d'intégration seulement), m3 (aucune relance des tests instables), m4 (`window.__metrics` absent du build de production) et m5 (tsconfig navigateur sans types Node, vérifié par mutation) sont corrigés.
- Tests (depuis `npm ci` propre) :
  - `typecheck` : OK ;
  - `npm test` : 7 fichiers, 75/75 ;
  - `build` : JS 5,06 Ko gzip ;
  - `test:e2e` : 22 réussis et 14 ignorés par profil (mobile Pixel 7, mobile 320×568, desktop) ; 110/110 sur 5 répétitions ;
  - 4 mutations réelles détectées par les tests.

## Branchement du vrai moteur (prêt, non intégré)

F1 est encore en revue Codex. Le vrai `mountGame` n'est donc **pas** dans la PR A1. L'essai a été fait dans un worktree jetable : A1 + F1 `72a2aa9`, avec ce `game-loader.ts` :

```ts
import { mountGame } from '../game';
export const IS_MOCK_GAME = false;
export const loadGame = (): StartGame => ({ prefs, onFirstPlacement, ...options }) =>
  mountGame({ ...options, sound: !prefs.muted,
    onEvent: (e) => { if (e.type === 'placement') onFirstPlacement?.(); } });
```

Résultats de l'essai :
- typecheck OK ;
- 171 tests unitaires ;
- e2e clavier, Espace martelé et tactile (2 profils mobiles) : 40/40 sur 10 répétitions.

À la bascule, il restera à retirer le mock du parcours (`mock-game.ts` deviendra inutilisé) et à adapter les e2e A1 qui dépendent du score du mock (seed % 5).

## Décisions demandées (contrat non figé, aucun changement unilatéral)

- **Codex (C0)** : figer ou refuser `onEvent`, `sound` et `reducedMotion` (B1/B2) ; `mountGame` lève en cas d'échec (B3, déjà géré par le shell) ; collecteur de mesures avant M2 (B4). Tant que rien n'est figé, ces options restent internes à `src/app/game-loader.ts`.
- **FLK (i1 de sa revue A0, voile de pause en double)** : je propose de garder le voile DOM du shell, accessible au clavier et au lecteur d'écran, et que le moteur n'affiche pas son propre texte quand le shell gère la pause. Cela demande une option ou un comportement côté F1 : à convenir dans le contrat.

## Avis indépendant sur le concept (inchangé, ≤ 15 lignes)

Le genre est saturé et la seed ne fait varier que la vitesse : le « même défi » est peu perceptible. FLK fait le même constat. Je recommande de garder ce moteur et de tester un **habillage quotidien** (une seed par jour UTC, carte de résultat sans spoiler) face au défi ami, dans le test des 10 personnes, avec des ordres contrebalancés. Signal qualitatif uniquement.

## Prochain pas

1. Revue FLK de la PR A1 (SHA indiqué dans la PR) et correction de ses remarques.
2. Après PASS Codex sur le dernier SHA F1 et fusion d'A0 : intégration de F0 puis F1 dans l'ordre des dépendances, bascule du loader et retrait du mock, nouveau SHA A1 à faire revoir.
3. Relire le nouveau SHA C0 de Codex.

## Blocages

- F1 : re-revue Codex attendue sur `6974c51`. Pour information, la reproduction R1 de Codex passe sur ce SHA ; ce n'est pas une revue.
- Contrat : décisions C0 ci-dessus.
