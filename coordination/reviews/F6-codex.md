# Revue V3 F6 — Codex

Date : 17 novembre 2026. Auteur : Claude Code FLK ; reviewer : Codex.
PR #28 ; SHA exact : `e7027481bccc95ffb9aa68395410b518b77bf036`.
**Verdict : PASS pour le moteur pur sur ce SHA.** Pas de validation du montage F7, qui n'est pas livré.

## Périmètre et preuves

Checkout détaché exact ; lecture complète de v2.ts, replay.ts, nouveaux tests/bot/golden et README. Comparaison v1 : simulation.ts et golden-v1.json inchangés (git diff --exit-code depuis 31575e4, code 0). Lecture de l'accord d'Alexis dans coordination/plans/V3-claude-code-alexis.md sur sa branche de plan, SHA f71e69e : accord des interfaces FLK §6 déjà donné.

Node 24.22.1 / npm 11.9.0, npm ci depuis lockfile : typecheck code 0, **324/324 tests livrés**, build code 0. Les avertissements jsdom « Canvas getContext not implemented » proviennent du repli testé de la collection, pas d'un échec de ces assertions ; aucune preuve Canvas physique déduite de jsdom. Les tests de borne jauge, activation/final bonus, compte à rebours, reprise unique et rejets de payload ont été lus.

Règles acceptées pour l'expérience V3 : jauge 10 ; +1 pose, +2 parfait, +3 à partir de la série de trois ; excédent perdu ; bonus alternatif Ralenti puis x2, cinq poses suivantes ; ralenti 3/5 arrondi vers le bas ; parfait 2 points, pose normale 1, doublés sous x2 ; hauteur séparée. Une reprise conserve base/score/hauteur, annule jauge/bonus et compte 360 ticks sans mouvement ; un second raté est définitif. Ces valeurs restent des hypothèses de playtest, pas des probabilités de succès.

## Observation de contrat, non bloquante dans l'usage examiné

verifyRunResult v2 compare score/height/perfectCount/continues/durationTicks mais **pas** bestPerfectStreak/bonusCount. Deux sondes Vitest supplémentaires exécutées sur golden-v2.vectors[0] : remplacer chacun par 99999 renvoie ok:true, mais outcome.result contient les valeurs **recalculées** 4 et 2. Une assertion demandant le rejet échoue dans les deux cas.

Le serveur #32 relu utilise deps.replay et outcome.result recalculé (pas les champs fournis par le client) : pas de falsification de classement démontrée. Ne jamais réutiliser le payload déclaré après ok:true pour des exploits ou récompenses ; prendre outcome.result. FLK peut renforcer la comparaison de ces deux champs pour garantir une égalité de résultat intégrale ; si ce code change, publier le nouveau SHA pour revue. Ce PASS ne prétend pas que la fonction compare tous les champs.

## Suite

F7 et F9 peuvent maintenant avancer : l'accord d'Alexis existe déjà ; voir coordination/V3-SUITE.md. Le shell ne peut pas utiliser SimulationV2 via le montage v1 inchangé : ne pas annoncer bonus/reprise comme jouables à ce stade. Tests d'affichage/entrées/visibilité, autorisation de reprise et compte à rebours requis dans la prochaine PR.

Aucun code de l'auteur poussé par Codex, aucun merge. Rapport documentaire à relire par Alexis suivant le cycle. Aucun téléphone réel, publicité, paiement ni serveur public validé ici.
