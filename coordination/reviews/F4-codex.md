# Revue F4 — Codex

Date : 17 novembre 2026 (Europe/Paris). Auteur : Claude Code FLK ; reviewer : Codex.
PR #19 : https://github.com/alexis97432/jeuiaflouze/pull/19
SHA exact revu : `22d0e6e491bb784c3f66c0c629aa8286512cd922`.
Dépendance : F3 `9e14f899f07609787dd1f0e287436562ecdf5bbb`, PASS Codex dans le rapport séparé.

**Verdict : PASS sur ce SHA, à intégrer après F3.** Aucune validation implicite d'A4 ou d'E1.

## Périmètre

Checkout exact et lecture du diff `9e14f89..22d0e6e` : blocks.ts, preview.ts, normalisation et option appearance dans mount/index, renderer et cache, démo, tests DOM/pixels. Inspection des planches des 18 combinaisons et des six matières en jeu : différences perceptibles sans dépendre uniquement du nom affiché. Le dessin est partagé entre l'aperçu et le jeu, indépendant de la progression, du stockage et du PRNG de partie.

`git diff --exit-code 9e14f89 22d0e6e -- src/game/core tests/game/golden-v1.json` : code 0. Lecture des tests de même RunResult sous chaque apparence, des valeurs inconnues, des bornes de cache, du clipping et de l'absence de RAF/écouteur dans l'aperçu.

## Vérifications réelles

Node 24.22.1 / npm 11.9.0, dépendances exactes du lockfile F4 :

- npm ci et typecheck : code 0.
- npm test : **220/220**.
- npm run build : code 0 ; JS **14,93 Ko gzip**.
- Première tentative de la chaîne e2e en parallèle avec F3 : **invalidée**. La configuration locale réutilisait le serveur 4173 de F3 ; celui-ci s'est arrêté avant les tests desktop F4, donnant trois ERR_CONNECTION_REFUSED. Ce problème vient de l'orchestration de revue, pas d'une régression du jeu.
- Vérification corrigée, serveur F3 arrêté, sans modification de source : `CI=1 PLAYWRIGHT_BROWSERS_PATH=/workspace/work/playwright-browsers npx playwright test --trace off --workers=2` → **25 e2e réussis, 14 ignorés par profil**, code 0. CI=1 empêche toute réutilisation de serveur étranger et aucune relance automatique n'est configurée.
- Harnais F4 dans son propre répertoire temporaire : `TMPDIR=/workspace/work/f4-browser-tmp PLAYWRIGHT_BROWSERS_PATH=/workspace/work/playwright-browsers npx playwright test -c tests/game/browser/playwright.config.ts --trace off --workers=2 --grep-invert 'coût de draw'` → **25/25 en 17,2 s**, code 0. Cela couvre les huit nouveaux cas F4 (six matières × trois univers aux pixels, 18 aperçus distincts, sélection réellement appliquée).
- Le cas coûteux de profilage draw à 50 étages n'a pas été répété sur F4 : il a été exécuté sur le parent F3 dans cette même revue. Ne pas annoncer 26/26 ni une mesure de performance F4 inexistante.

## Contrat accepté et suite

Accepte les identifiants convenus avec Alexis et l'option additive publique appearance. Le contrat est aligné dans docs/CONTRACTS.md dans cette livraison documentaire ; à relire par Alexis. Normalisation des identifiants inconnus et false si Canvas indisponible dans l'aperçu sont appropriés ; la propriété/déblocage reste vérifiée par le shell. Ne pas exposer la modification de thème comme un changement des règles.

Alexis peut ensuite connecter sa sélection au montage et remplacer les aperçus CSS par renderAppearancePreview, en réutilisant les types publics. Sa PR d'intégration modifiée devra être revue par FLK sur son nouveau SHA avant publication. Tester sauvegarde/recharge, collection verrouillée, fallback sans Canvas et reprise de partie après navigation.

Aucun vrai téléphone, Safari/Firefox, test humain ou écoute du son dans cette revue. Ces visuels ne doivent pas masquer le défaut E1 multi-onglets signalé par FLK : cette autre livraison garde son propre verdict tant qu'elle n'est pas corrigée et revalidée.
