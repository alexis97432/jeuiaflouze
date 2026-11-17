# Nouvelle revue F8b R1 — Codex C9

Auteur : Claude Code FLK ; reviewer : Codex. Date : 17 novembre 2026.
PR #41 ; SHA exact : `28c0ec1b32c410e5f9086fea70b5bc449a2f4616`.
**Verdict : PASS**. Ce verdict remplace CHANGES_REQUESTED sur 1509f1e pour R1.

Lecture complète du correctif (4 fichiers) : ResultCard accepte Partial<AnyAppearance>, normalise avec resolveAnyAppearance ; le harnais utilise désormais l’entrée publique sans drawSkin interne. Les tests couvrent Graphite/Lave/Cristal distincts de Gomme et le repli inconnu.

Contrôles exécutés sur checkout exact : 14 tests ciblés passent (suite card livrée et ancienne reproduction indépendante Codex désormais verte), typecheck et build passent ; test Chromium card.spec.ts 1/1 passe, avec comparaison réelle des pixels Graphite/Gomme et repli inconnu. La suite complète de 356 tests précédemment exécutée n’a pas été répétée pour ce correctif limité. Aucun téléphone physique testé.

Alexis peut intégrer #41 sur ce SHA après lecture de cette revue. #42 reste une livraison Alexis : FLK doit revoir son dernier SHA et sa CI avant intégration/publication. Ne pas confondre fusion #45 et publication du shell final V3. Le workflow Pages et source-commit.txt doivent identifier le commit effectivement publié.

---

# Revue V3 F8b — Codex

Auteur : Claude Code FLK ; reviewer : Codex. Date : 17 novembre 2026.
PR #41 ; SHA exact : `1509f1e64801b3b334410c13c34f20a6947373cb`.
**Verdict : CHANGES_REQUESTED**, point R1 à corriger avant exposition finale de la V3 et nouvelle revue du nouveau SHA.

## Points corrects et preuves

Lecture du diff depuis F9 : AnySkinId, AnyAppearance, resolveAnyAppearance et validation additive sont compatibles avec les consommateurs V2. mountGame et renderAppearancePreview appliquent les nouvelles apparences sans modifier le rejeu. Ne pas élargir silencieusement SkinId V2 est un bon choix de compatibilité.

Checkout exact, Node 24.22.1 / npm 11.9.0 : npm ci, typecheck, **356/356 unitaires livrés**, build code 0 (JS 24,39 Ko gzip). Suite navigateur de cette pile avec `--grep-invert 'coût de draw' --workers=2` : **38/38**, 41,5 s ; cas de profilage coûteux exclu. Les tests pixels/bonus/reprise/carte existants passent, mais ne couvrent pas R1. Pas de preuve de test physique.

## R1 — P2 : les nouvelles apparences sont perdues sur la carte publique

Emplacement : `src/game/render/card.ts`, ResultCard.appearance et renderResultCard (normalisation par resolveAppearance).
F8b élargit les entrées de mountGame et renderAppearancePreview, mais oublie renderResultCard. Son type reste Partial<Appearance> V2 ; à l'exécution, `appearance.skin='graphite'` est replié silencieusement sur Gomme. Un skin acheté/choisi dans le jeu n'apparaîtra donc pas sur la carte partagée via l'API convenue.

Reproduction exécutée : sur un golden v2 valide, appeler renderResultCard avec la même partie et thème Confiserie, une fois skin='graphite', une fois skin='gomme', sans options.drawSkin. Un contexte Canvas factice enregistrant toutes les commandes, styles et stops de gradient donne une trace **strictement identique**. Le test `expect(render('graphite')).not.toEqual(render('gomme'))` échoue réellement. Le type public refuse aussi AnyAppearance.skin V3 sans cast.

Le harnais actuel masque l'oubli : sa méthode card force `appearance.skin='gomme'` puis passe le skin par `options.drawSkin`, marqué interne. Les captures de carte lave/holographique ne prouvent donc pas l'appel public du shell.

Correction : accepter Partial<AnyAppearance> sur ResultCard, utiliser resolveAnyAppearance dans renderResultCard, et tester le passage **via card.appearance**, sans option interne. Comparer au minimum Graphite/Gomme et Lave/Gomme sur les mêmes partie/thème, vérifier aussi le repli d'un identifiant inconnu. Ajouter une régression de typage/import public. Ne pas demander à Alexis de contourner avec un paramètre caché.

Aucun code de FLK modifié/poussé par Codex. Le test de reproduction reste dans le worktree jetable de revue, pas sur la branche de l'auteur. Après correction, nouveau SHA à revoir ; F7 et F9 gardent leurs PASS séparés sur leurs SHA exacts.
