# Revue V3 F8 — Codex

Date : 17 novembre 2026. Auteur : Claude Code FLK ; reviewer : Codex.
PR #30 ; SHA exact : `57928d76bb492750cb1d39c50b6f04fca3055d1f`.
**Verdict : PASS sur le rendu interne livré.** Ce n'est pas encore la connexion des objets boutique/passe à l'API publique.

## Lecture et contrôles

Checkout détaché exact ; lecture du diff depuis 31575e4 : blocks, renderer, mount/preview internes, démo et tests. Inspection visuelle de coordination/captures/F8/planche-42-apparences.png : huit matières identifiables, avec réserves de lisibilité à juger par l'humain pour pixel/cristal sur petit écran. Core et golden-v1 inchangés (diff --exit-code, code 0).

Node 24.22.1 / npm 11.9.0, lockfile propre : npm ci, typecheck et build code 0 ; **308/308 tests livrés**, JS 22,04 Ko gzip. Les assertions de contraste et d'indépendance de la v1 ont été lues. Le renvoi vers Gomme de l'API publique pour un skin V3 est actuellement intentionnel et testé : ne pas le présenter comme une intégration boutique terminée.

Commande navigateur exécutée : PLAYWRIGHT_BROWSERS_PATH=/workspace/work/playwright-browsers npx playwright test -c tests/game/browser/playwright.config.ts --trace off --workers=2 --grep-invert 'coût de draw' → **34/34**, dont clipping réel des huit nouvelles matières dans les trois univers et les 42 aperçus distincts, en 18,2 s. Le cas coûteux de profilage CPU a été exclu ; pas de 35/35 ni de mesure sur vrai appareil revendiqués par cette revue. Pas de mutation de code pour obtenir le résultat.

## Accord d'interface retrouvé

Alexis adopte déjà les huit identifiants dans son plan (PR #25, f71e69e). La raison « attendre l'accord d'Alexis » n'est donc plus une dépendance actuelle. FLK doit produire le petit commit d'exposition public, puis Codex revoir ce nouveau SHA ; Alexis adapte libellés/catalogues/validation dans la même intégration coordonnée. Éviter une fusion qui casse Record<SkinId,...> avant les consommateurs.

Catalogue convenu : graphite/nacre/holographique en pièces ; pixel/galaxie/lave piste gratuite ; or/cristal premium/argent réel seulement en état Indisponible, ou Démo de développement tant qu'aucun fournisseur réel n'existe. Holographique fixe accepté pour cette version (motifs différents par étage), pas d'animation prétendue.

Aucun téléphone physique, écoute humaine ou avis testeur dans cette revue. Rapport documentaire à relire par Alexis ; aucun merge ni fichier de code de l'autre agent modifié.
