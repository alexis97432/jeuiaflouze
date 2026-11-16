# Nouvelle revue F1 — Codex, 16 novembre 2026

- Auteur : Claude Code FLK ; reviewer : Codex.
- PR #3, SHA exact : `b44d2a63ab5f2121eeb4e15acd55ae67bf3e7e59`.
- **Verdict : PASS sur ce SHA.** R1 et R2 de la revue précédente sont corrigés. L'ancien CHANGES_REQUESTED ci-dessous reste historique et ne vise que `0896195`.

## Vérification réelle

Checkout détaché du SHA exact, fusion d'essai sans conflit avec A0 `e84647e0a5b1acca0e724977eecddaa8d113a417`, Node 24.22.1 / npm 11.9.0. Lecture du diff complet depuis la précédente revue, des nouveaux tests DOM et des régressions de recalage.

- npm ci depuis le lockfile A0 : 88 paquets.
- npm run typecheck : code 0.
- npm test : **128/128**, dont 111 F0/F1 ; reproduction exacte R1 incluse et assertions relues. Les gestes sont rebasés du temps abandonné, bornés et fusionnés ; plus d'entrée orpheline dans cette reproduction.
- npm run build : code 0. Toujours le mock A0 pour ce build : aucune prétention d'intégration A1.
- Construction du harnais via Vite fourni par A0 : réussie sans dépendance supplémentaire, chemin ESM compatible.
- Premier lancement navigateur : bloqué par Chromium absent dans cet environnement, pas un défaut du jeu. Installation locale par `PLAYWRIGHT_BROWSERS_PATH=/workspace/work/playwright-browsers npx playwright install chromium`, puis commande :
  `PLAYWRIGHT_BROWSERS_PATH=/workspace/work/playwright-browsers npx playwright test -c tests/game/browser/playwright.config.ts --workers=2`
  → **13/13 en 16,6 s**, sans modification de source ni relance masquant un défaut.
- Tests couvrent toucher sans doublon, clavier, fin/onEnd/rejeu, longue série, resize/DPR, pause/visibilité, démontage/audio, Canvas indisponible et reduced-motion. Les tests DOM supplémentaires tournent aussi dans npm test, donc dans la CI commune ; prévoir avec Alexis l'étape navigateur dédiée.

## Contrat et limites

J'accepte les options additives proposées par FLK : onEvent, sound et reducedMotion à la création ; erreurs synchrones de montage. Le contrat corrigé de cette livraison Codex formalise cela et doit être relu par Alexis avant gel. Pas de setter à chaud imposé pour M1 : réglage du son entre parties seulement.

Pas de téléphone physique, Safari/iOS ou écoute humaine du son vérifiés. Le PASS porte sur F1, pas sur A1 encore en préparation. Alexis peut intégrer ce SHA après ses dépendances et vérification de la tête de PR, puis brancher le vrai moteur ; FLK devra revoir le nouveau SHA A1.

---

## Historique de la première revue

# Revue F1 — Codex

Auteur : Claude Code FLK ; reviewer : Codex. Date : 16 novembre 2026.
PR #3 : https://github.com/alexis97432/jeuiaflouze/pull/3
SHA exact : `0896195ca4e10387b9dccfff8f6253f27c1ed873`.
Base de compatibilité : A0 `e84647e0a5b1acca0e724977eecddaa8d113a417`.

**Verdict : CHANGES_REQUESTED.** Ne pas intégrer avant correction et nouvelle revue du nouveau SHA.

## Périmètre

Lecture complète index.ts, input/, render/, demo/, tests fixed-step et harnais navigateur. Checkout exact ; fusion d'essai A0 + F0 + F1 sans conflit, dans un worktree jetable. Node 24.22.1 / npm 11.9.0, lockfile A0. Aucun code auteur modifié à distance, aucun merge distant.

## R1 — P1 : geste retardé après recalage d'une image gelée

Emplacement : src/game/input/fixed-step.ts:69 et :83–87.
press attribue un tick dans l'ancienne échelle ; advance abandonne le retard au-delà de 30 ticks et recale l'ancre, sans rebaser pending. Un toucher reste alors dans le futur logique et déclenche une pose retardée, sur une autre position du bloc.

Reproduction exécutée avec un test Vitest supplémentaire, sur les vraies classes :
```ts
const sim = new Simulation({ seed: 1, rulesVersion: 1 });
const d = new FixedStepDriver(sim);
d.resume(0);
d.press(1000); // mémorise tick 120
d.advance(1000); // simule seulement 30 ticks et recale l'ancre
for (let t = 1010; t <= 1300; t += 10) d.advance(t);
// réel : tick=66, pendingPresses=[120], inputTicks=[]
expect(sim.inputTicks.length).toBe(1); // ÉCHEC : reçu 0
```
À cadence normale ensuite, cette pose survient vers 1750 ms, sans nouveau geste. Un gel plus long amplifie le délai.

Correction : définir une politique pour les gestes pendant le temps abandonné ; ajuster ensemble ancre et entrées pour éviter ces poses fantômes différées. Préserver ordre, fusion par tick et validité du rejeu. Ajouter tests geste pendant gel, geste après recalage, plusieurs gestes et plusieurs gels. Le test de gel livré n'injecte aucun geste.

## R2 — P1 : harnais incompatible avec l'installation A0

Emplacement : tests/game/browser/build-harness.ts:1 et :8.

1. Avec npm ci depuis A0, npm run typecheck échoue TS2307 : module esbuild absent. Playwright F1 échoue aussi sur cet import. Vite 8 du projet ne fournit pas cette dépendance.
2. Installation temporaire **hors dépôt** d'esbuild 0.25.12, puis lien dans node_modules du worktree de revue uniquement : `npx playwright test -c tests/game/browser/playwright.config.ts --workers=2` échoue encore : **ReferenceError: __dirname is not defined in ES module scope**, ligne 8. A0 déclare type=module.

Correction : chemin ESM via fileURLToPath(import.meta.url) ou équivalent ; dépendance déclarée/verrouillée avec accord d'Alexis (propriétaire package/lock), ou réutilisation du bundler déjà présent. Rendre ces tests exécutables par CI : la config Playwright racine ne lance actuellement que tests/e2e.

Relancer depuis npm ci propre : typecheck, unitaires, navigateur F1. Les tests navigateur n'ont pas démarré dans ma revue ; aucun PASS navigateur revendiqué.

## Résultats complémentaires et limites

Les **114 tests unitaires livrés passent** (94 précédents + 20 fixed-step). Mon test supplémentaire R1 échoue réellement (0 pose au lieu de 1). Sa reproduction est ci-dessus, aucun fichier de test ajouté sur la branche de FLK.

Les tests de cadence livrés ne couvrent pas ce recalage avec entrée en attente. Pas de test physique iOS/Android, de FPS ni validation produit dans cette revue.

B1/B2 de la revue C0 Alexis restent à convenir avant A1 : événement de placement et préférences modifiables à chaud. sound/reducedMotion F1 ne fournissent ni onEvent ni setter public. C'est une correction du contrat Codex à coordonner, pas une invitation à modifier unilatéralement l'API. Canvas nul lève déjà Error dans Renderer : documenter ce comportement dans le contrat et prévoir le rattrapage côté shell.

## Suite

FLK corrige R1/R2 sur sa branche F1 et publie le nouveau SHA. Codex refait la revue. Alexis peut préparer URL/stockage/partage A1 sans intégrer F1 non validé. F0 conserve son PASS séparé.
