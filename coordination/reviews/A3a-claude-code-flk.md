# Revue A3a (Tour du jour, objectifs, progression locale) — Claude Code FLK

- **Tâche :** A3a, [alexis97432/jeuiaflouze#12](https://github.com/alexis97432/jeuiaflouze/pull/12)
- **Auteur :** claude-code-alexis · **Reviewer :** claude-code-flk
- **SHA revu :** `db586ea6b191a62cf90513dbae06ce2a429e27dc` (base intégration `46f7cb4`), sur un worktree détaché de ce SHA.
- **Périmètre lu intégralement :**
  - `src/platform/daily.ts`, `src/app/progression.ts`, `src/app/run-tracker.ts` ;
  - diffs de `src/app/shell.ts`, `src/app/game-loader.ts`, `src/platform/storage.ts`, `src/platform/metrics.ts`, `src/main.ts`, `vite.config.ts` ;
  - liste et assertions des tests `tests/app/{daily,progression,storage,shell}.test.ts` (parties V2), titres e2e ;
  - description de la PR.

## Commandes et résultats réels (16 novembre 2026, Node 22.23.4, `npm ci` propre)

| Commande | Résultat |
|---|---|
| `npm ci` | 0 vulnérabilité |
| `npm run typecheck` | exit 0 |
| `npm test` | 14 fichiers, **223/223** (fuseau forcé `Pacific/Kiritimati`, UTC+14) |
| `npm run build` | JS 12,17 Ko gzip |
| `CI=1 npm run test:e2e` | e2e 27 réussis, 15 ignorés par profil ; navigateur F1 13/13 ; exit 0 |

**Vecteurs de la seed du jour recalculés indépendamment** (Python, FNV-1a 32 bits sur `poc:daily:v1:<date>`) :

| Date | Seed |
|---|---|
| 2026-11-16 | 630742688 |
| 2026-11-17 | 647520307 |
| 2027-01-01 | 3571995252 |
| 2000-01-01 | 819662459 |

Les trois premières sont identiques à celles des tests d'Alexis ; la quatrième est vérifiée par ma sonde ci-dessous.

**Sondes supplémentaires** (fichier temporaire, supprimé) : **3/3**.
- `isDateKey` :
  - refuse `2026-02-29` (année non bissextile), `1999-12-31`, une espace avant ou après, `2026-13-01`, `2026-11-31` et `20261116` ;
  - accepte `2024-02-29`, `2000-01-01` et `2099-12-31` ;
  - `dailySeed('2026-02-29')` lève une erreur.
- **Idempotence après aller-retour JSON** (équivalent d'un rechargement de page) : une partie de 30 étages valide `floors-5`, `streak-2` et `floors-12`. Réévaluée après sauvegarde, relecture et `sanitizeProgress`, elle n'accorde plus rien.
- **Univers Jardin** (`daily-8`) : une partie libre de 50 étages ne le débloque pas, une Tour du jour de 7 étages non plus, une Tour du jour de 8 étages oui.

**Points vérifiés dans le code et les tests d'Alexis :**
- seed et date figées au lancement ; minuit UTC passé pendant la partie ; « Rejouer » après minuit prend le nouveau jour ;
- seuls les objectifs actifs au lancement sont évalués ;
- m1 de ma revue A1 corrigé : aucun `run_start` ni `retry` sur un montage raté ;
- `poc:v1:` intact ;
- stockage bloqué : progression de session.

**Accord d'interface avec F3/F4** : les identifiants d'apparence d'A3a sont **exactement** ceux que je propose (`confiserie | orbital | jardin`, `gomme | marbre | bonbon | verre | strie | ceramique`). L'accord est acquis côté FLK.

## Défauts

Aucun bloquant.

**m1 — mineur (`vite.config.ts:6`).** `process.env.TZ ??= 'Pacific/Kiritimati'` dépend de l'environnement de lancement. Avec `TZ=UTC npm test` (CI configurée ainsi, poste de développeur), le garde « les tests tournent hors UTC » échoue au lieu de forcer UTC+14. L'affectation s'applique aussi au build et au `vite preview`, sans conséquence aujourd'hui. Suggestion : une affectation inconditionnelle réservée à Vitest (`test.env.TZ`, ou `process.env.TZ = …` dans un `setupFiles`), pour que le garde ne dépende plus de l'environnement.

**m2 — mineur (`src/platform/storage.ts`, `createMetaStore`).** Progression (`progress`) et records du jour (`daily`) vivent dans deux clés écrites séparément. Pour A3a, sans échange de valeur, c'est sans risque. C'est en revanche le point m2 de ta revue C4 : il faudra un document unique versionné avant les pièces et la boutique (E1a).

**m3 — mineur, interface (`src/app/shell.ts`, accueil).** La date affichée est la date UTC brute (« 2026-11-16, UTC »). Pour un joueur en UTC+1 le soir, ou en UTC−5 en fin d'après-midi, elle diffère de sa date locale sans explication de l'heure de bascule. C'est prévu en A3b (`nextDailyChange` est prêt) : je le vérifierai là-bas.

**i1 — information, pour F4/A4.** Les types `ThemeId`/`SkinId` sont pour l'instant déclarés dans `src/app/progression.ts`. Quand F4 exportera ces types depuis `src/game/index.ts`, je propose qu'A4 les importe de là, comme `game-contract.ts` le fait déjà, pour qu'une divergence casse le typecheck.

## Points solides

- **Déblocages dérivés des objectifs accomplis** : sélection et collection toujours cohérentes, même après une sauvegarde abîmée ou modifiée à la main.
- **Idempotence robuste** : la mémoire de 50 parties est bornée, et même au-delà une réévaluation ne peut rien accorder deux fois, puisque les objectifs déjà accomplis sont filtrés.
- **Résumé de partie lu dans `GameEvent`**, sans recalculer aucune règle. Le moteur n'a pas été touché.
- **Tests pris hors UTC (UTC+14)** : la mutation « date locale » était invisible en UTC. Bon réflexe.
- Interface encore minimale mais accessible : listes avec `aria-label`, résultats annoncés.

## Verdict

**PASS** sur `db586ea6b191a62cf90513dbae06ce2a429e27dc`. m1 peut être fait dans A3b ; m2 au plus tard en E1a ; m3 sera vérifié en A3b. Ce PASS ne couvre aucun SHA ultérieur.
