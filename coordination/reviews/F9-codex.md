# Revue V3 F9 — Codex

Auteur : Claude Code FLK ; reviewer : Codex. Date : 17 novembre 2026.
PR #40 ; SHA exact : `d8ba36f09d2a8a5853c8427da12a6a4636e7f51e`.
**Verdict : PASS pour la carte livrée sur F7.** Le défaut d'élargissement des apparences V3 est traité dans la revue F8b séparée, pas confondu avec la version F9 qui garde des entrées d'apparence V2.

## Lecture et contrôles

Checkout exact ; lecture card.ts et tests : rejeu borné puis reconstruction du motif/tour, données normalisées utilisées ; motif limité à 75 et rendu de tour à 16 blocs. La simulation conserve néanmoins sa pile bornée par maxInputs du rejeu, pas une mémoire O(16) totale : ne pas annoncer une taille indépendante des limites d'entrée. Les anciens résultats v1 affichent des étages ; v2 sépare points/hauteur et marque la reprise. Pas de nom/identifiant/URL ni d'appel réseau dans la carte.

Node 24.22.1 / npm 11.9.0, npm ci propre, typecheck, **355/355 unitaires** et build code 0 (JS 24,38 Ko gzip). Inspection de la capture carte-v2-reprise-jardin.png. Test card.spec.ts lancé sur ce checkout exact dans TMPDIR distinct : **1/1**, 2,4 s, code 0. Le même test passe dans la pile F8b, parmi 38 tests navigateur ciblés. Aucun fichier natif partagé sur téléphone par Codex.

Les compteurs de la carte viennent du rejeu ; seuls score/perfectCount/durationTicks déclarés sont explicitement comparés dans summarizeRun. Des champs complémentaires déclarés incohérents ne sont pas utilisés pour dessiner une fausse valeur : le résultat normalisé reste la référence. Garder cette discipline dans le shell et les récompenses.

## Suite Alexis

Brancher resultImage avec le vrai export, conversion toBlob/File et secours téléchargement/lien ; une annulation du partage n'est pas un succès. Garder les cartes facultatives si Canvas ou la conversion échouent. Utiliser une apparence publique correcte après correction F8b, pas le contournement interne drawSkin du harnais comme contrat caché.

Le partage v2 doit conserver rulesVersion=2 dans les liens ; la PR A6b signale encore un lien émis en v1 après une partie v2. Ce point relève du shell et n'est pas validé par le PASS de la carte. FLK doit le vérifier sur la prochaine livraison A6 avant publication.
