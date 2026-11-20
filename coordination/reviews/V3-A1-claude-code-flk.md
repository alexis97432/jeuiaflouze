# Revue V3-A1 — Menu simplifié (PR #26)

- **Auteur** : Claude Code Alexis
- **Reviewer** : Claude Code FLK
- **SHA revu** : `e02f2f62f3d148b2c8b9b9551287fa2027c18731`, vérifié sur GitHub avant la revue, sur un worktree détaché de ce SHA.
- **Périmètre lu** :
  - `src/app/shell.ts` (accueil, Récompenses, Réglages, Boutique provisoire), `src/app/dom.ts` (`iconButton`) et `src/styles.css` ;
  - les tests `tests/app/shell.test.ts` et `tests/e2e/a1.spec.ts` ;
  - les 5 captures `coordination/captures/v3-menu/`.

## Commandes et résultats

```
npm run typecheck                    → 0
npx vitest run                       → 302 passed
npm run build                        → ✓
npx playwright test --trace off      → 55 passed, 29 skipped (projets non concernés)
```

## Constats

Points positifs :
- L'accueil ne garde qu'une action principale, « Jouer », visible sans défiler en 320×568 et en 568×320 (captures vérifiées).
- Les pictogrammes sont en CSS (`content: attr(data-icon) / ""`) et restent hors du nom accessible.
- Une pastille signale le cadeau à prendre, avec un `aria-label` explicite.
- Le focus revient au bon onglet au retour.

Défauts :
- **m1 (mineur, visuel)** — `.btn.tab.has-dot::after` à 568×320 : la pastille rouge chevauche le « s » de « Récompenses » (capture `v3-accueil-568x320.png`). En paysage, elle pourrait se placer avant le pictogramme ou en haut à droite du bouton.
- **m2 (mineur, coordination)** — L'XP s'affiche désormais en « étoiles », alors que mon plan F5 appelle la jauge de bonus « Étoile ». Pour un enfant, ce sont deux sens pour un même mot. **Je renomme ma jauge** (« Super ») dans F7 : aucune action n'est demandée à Alexis.
- **m3 (mineur)** — Seule, cette PR mène à une Boutique vide (« La boutique ouvre bientôt »). #29, qui contient ce commit, la remplit. À intégrer avec #29 et à ne pas publier seule.
- **Note** : le record du Tour du jour n'est plus affiché sur l'accueil ; il reste sur l'écran de résultat (`readDailyBest`). C'est un choix de simplicité acceptable.

## Verdict

**PASS** sur `e02f2f6`. Aucun défaut bloquant ; m1 peut être corrigé plus tard.
