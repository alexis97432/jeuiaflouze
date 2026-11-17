# Revue V3 F7 — Codex

Auteur : Claude Code FLK ; reviewer : Codex. Date : 17 novembre 2026.
PR #39 ; SHA exact : `cf95c51632ef50419ecd9ce40b124a343bcc6569`.
**Verdict : PASS pour F7 sur ce SHA**, après intégration des dépendances F6/F8 validées. Pas de PASS implicite du shell A6b.

## Périmètre

Checkout détaché exact ; lecture de fixed-step, mount, diff renderer/audio et tests mount-v2.dom/v2.spec. Revue F6 précédente complétée : bestPerfectStreak et bonusCount sont désormais comparés par verifyRunResult. La v1 et les anciens défis restent des chemins distincts. Les nouvelles fonctions du handle sont optionnelles dans le type pour compatibilité avec les doubles, mais fournies au montage réel.

Les états running/countdown avancent ; fallen/ended gèlent le temps et vident les appuis en attente. Pendant le décompte, press rejette les gestes dès réception. allowContinue absent termine au raté sans laisser un écran quotidien bloqué. pause, visibilité, destruction et décision tardive sont couverts par des assertions lues. La décision d'octroi d'une vie/pub reste externe au moteur.

## Vérification réelle

Node 24.22.1 / npm 11.9.0 ; npm ci propre et typecheck code 0. Une première exécution des trois suites en parallèle a dépassé le timeout 5 s du test core v1 de 200 parties (342 passent, 1 timeout). Aucun défaut d'assertion de gameplay. Après fin des autres suites, contrôle sans changement de source avec `npx vitest run --maxWorkers=1` : **343/343**, puis build code 0, JS 24,37 Ko gzip. Le timeout et le contrôle isolé sont rapportés, pas masqués comme un premier succès.

Commande réelle sur le checkout exact F7 : PLAYWRIGHT_BROWSERS_PATH=/workspace/work/playwright-browsers npx playwright test -c tests/game/browser/playwright.config.ts --trace off v2.spec.ts --workers=2 → **2/2**, 17,5 s. La pile descendante F8b, où core/driver sont inchangés, passe aussi 38 tests navigateur ciblés (offre, reprise, compte à rebours, fin et carte inclus). Aucun profilage CPU coûteux répété dans ce lot.

## Conditions d'intégration

F6 #28 et F8 #30 doivent être sortis du brouillon par FLK avant leur intégration sur les SHA revus. Alexis intègre ensuite F7 après contrôle du head ; FLK revoit A6b #42 qui le consomme. Aucun service de pub réel ni compte de paiement n'est requis pour un test de reprise explicitement en démo. Rien ne doit accorder une vraie récompense de pub en production sans fournisseur.

Pas de téléphone physique/Safari ou écoute humaine ; les réglages de jauge restent à tester auprès des deux joueurs. Aucun fichier de l'auteur modifié à distance et aucun merge dans cette revue.
