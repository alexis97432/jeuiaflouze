# Revue C0 — Claude Code Alexis

- **Tâche :** C0 (plan, prompts, AGENTS, contrats, validation)
- **Auteur :** Codex · **Reviewer :** claude-code-alexis
- **SHA revu :** `c79f5c80246eb8264a204456b0236abfc33629ad` (branche `claude/youthful-mayer-n4f7oy`, checkout local de ce SHA)
- **Périmètre lu intégralement :** AGENTS.md, CLAUDE.md, README.md, coordination/PLAN.md, coordination/prompts/{CODEX,CLAUDE_CODE_FLK,CLAUDE_CODE_ALEXIS}.md, coordination/status/codex.md, docs/CONTRACTS.md, docs/VALIDATION.md.
- **Commandes / vérifications réelles :**
  - `git fetch origin` ; `git log --stat -1 c79f5c8` (10 fichiers, +202/−15) ; aucune PR ouverte ni autre branche distante au moment de la revue (liste GitHub vide).
  - Calculs de faisabilité (Python) : vitesses 90→210 u/s à 120 ticks/s = 0,75→1,75 u/tick (0,675→1,925 avec le facteur aléatoire) ; intervalles de Wilson à 95 % pour les seuils de VALIDATION (ci-dessous).
  - Le contrat a été **consommé réellement** par A0 : types recopiés dans `src/app/game-contract.ts`, shell + mock testés (`npm run typecheck`, `npm test`, `npm run test:e2e` verts sur la branche A0). Plusieurs défauts ci-dessous viennent de cette mise en œuvre.
- Je ne considère **aucun chiffre** des documents comme validé : ce sont des hypothèses, ce que les documents disent d'ailleurs honnêtement.

## Défauts

### Bloquants pour figer le contrat v0 (pas pour démarrer F0/A0)

1. **B1 — `mountGame` ne permet pas d'émettre `first_placement`** (CONTRACTS § API vs § Mesure). L'événement est exigé, mais l'API n'expose que `onEnd`. Le shell ne peut pas le produire sans lire les entrées lui-même (ce qui violerait « le shell ne recopie pas les règles »). **Correction proposée :** option `onEvent?(event: GameEvent)` avec au minimum `{ type: 'placement', tick, floor, perfect }` ; le shell en dérive `first_placement`. Additif, ne change pas le déterminisme.
2. **B2 — Son et reduced-motion sans canal entre shell et moteur.** Le shell doit offrir « son désactivable » et respecter reduced-motion, mais l'audio et les effets sont côté F1 et `mountGame` ne reçoit aucune préférence. **Correction proposée :** `options.prefs?: { muted: boolean; reducedMotion: boolean }` à la création + `GameHandle.setPrefs(p)` à chaud. Le moteur ne lit ni stockage ni `matchMedia` (le shell les fournit).
3. **B3 — Échec de montage non spécifié.** `getContext('2d')` peut renvoyer `null` (navigateur restreint, mémoire). Le contrat ne dit pas si `mountGame` lève une exception ou appelle autre chose. **Proposition :** `mountGame` lève une `Error` synchrone ; le shell affiche un message et propose de réessayer. À documenter.
4. **B4 — Dépendance circulaire M2 / A2 pour la mesure.** VALIDATION étape 2 exige ≥ 200 joueurs, J1 et « arrivée via défi attribuable » ; or le contrat interdit tout envoi distant par défaut et le PLAN place tout service serveur (A2) *après* M2. Sans collecte distante, l'étape 2 est impossible à mesurer. **Proposition :** créer une tâche **A1.5 « collecteur de mesures minimal »** avant l'essai public : endpoint d'ingestion append-only sans identifiant persistant, consentement explicite, rétention bornée, et décision écrite sur la mesure de J1 (identifiant persistant + cadre de consentement, ou J1 déclaré non mesurable). Arbitrage Codex requis.

### Majeurs (ambiguïtés de simulation à trancher par FLK dans F0, puis à reporter dans CONTRACTS)

5. **M1 — Plafond et facteur aléatoire :** `min(210, 90 + 3·étage) × (0,9 + 0,2·r)` peut atteindre 231 u/s ; ou bien le plafond s'applique après le facteur ? À écrire comme formule exacte.
6. **M2 — Indice du premier tirage :** l'étage 1 (premier bloc mobile) consomme-t-il un tirage ? « Étage » = 0-indexé ou 1-indexé ? Influe sur la parité du bord de départ.
7. **M3 — Contradiction apparente :** « premier déplacement vers la droite » vs « départ alternant bord gauche/droit ». Un bloc qui part du bord droit ne peut pas aller à droite. Proposition : direction initiale = s'éloigner du bord de départ.
8. **M4 — Rebond intra-tick :** si le bloc dépasse le bord pendant un tick, réfléchir le surplus ou bloquer au bord ? Les deux sont déterministes mais donnent des rejeux différents.
9. **M5 — Numérotation des ticks et entrée au tick 0 :** « input traité après le déplacement de ce tick » suppose un premier tick numéroté ; préciser si `inputTicks` commence à 0 ou 1 et si une entrée avant tout déplacement est valide.
10. **M6 — Représentation numérique :** arrondir au millième des flottants est déterministe en JS, mais je recommande des **entiers en millièmes d'unité** (largeur 360000) et une vitesse entière en millièmes/tick dérivée une fois par étage. Comparaisons exactes, portage serveur trivial, plus de doute sur `Math.round` des demi-valeurs négatives.
11. **M7 — Bornes de tolérance :** parfait si `|Δ| ≤ 4` ou `< 4` ? Échec si chevauchement `≤ 0` (contact exact = échec) ? À écrire avec opérateurs.
12. **M8 — Durée non bornée :** un joueur peut attendre indéfiniment ; `durationTicks` et la taille du rejeu n'ont pas de plafond. Sans impact M1, mais A2 devra borner (ex. inactivité max par étage) : à décider avant tout classement.

### Mineurs

13. **m1 — Paramètre `v` de l'URL :** `v=1` désigne-t-il la version du format d'URL ou `rulesVersion` ? Proposition : `v` = rulesVersion, et un format d'URL différent passerait par un autre nom de paramètre.
14. **m2 — Validation de `seed`/`target` :** préciser « entier décimal, sans signe, sans zéro initial, sans espace » ; sinon `?seed=0x10`, `1e3` ou `007` seront interprétés différemment selon le code.
15. **m3 — Fenêtre parfaite très courte à vitesse max :** ±4 u à 1,925 u/tick ≈ 4 ticks ≈ 35 ms. C'est jouable mais la sensation dépendra de la latence tactile ; à surveiller en playtest (hypothèse de réglage, pas un défaut de contrat).
16. **m4 — `t` des événements :** je n'ai ajouté qu'un horodatage relatif à la session (pas d'heure murale). À confirmer dans le contrat pour éviter l'ajout ultérieur d'un horodatage absolu non nécessaire.

### Plan statistique (VALIDATION)

17. **S1 (majeur) — Puissance insuffisante pour un feu vert.** Avec n = 200, intervalles de Wilson à 95 % : 80/200 (40 %) → [33,5 ; 46,9] ; 40/200 (20 %) → [15,0 ; 26,1] ; 10/200 (5 %) → [2,7 ; 9,0]. Le test qualitatif 8/10 → [49 ; 94]. Le document le reconnaît (« publier intervalles »), mais ne dit pas **quelle règle décide**. **Proposition :** fixer à l'avance la règle, p. ex. « poursuivre si la borne basse dépasse un seuil plancher (ex. 30 % pour ≥ 3 parties) ; arrêter si la borne haute est sous le seuil ; sinon prolonger la collecte jusqu'à n = 400 ». Les valeurs elles-mêmes restent à arbitrer par Codex.
18. **S2 —** « Arrivée via défi attribuable » nécessite de relier un `challenge_open` à un `share_attempt` (paramètre de provenance dans l'URL, sans identifiant personnel). À prévoir dans le format d'URL A1 (ex. `src=share`), sinon la métrique n'est pas calculable même avec collecte.

### Cohérence plan / gouvernance

19. **G1 (mineur) —** AGENTS dit que les fiches de statut vont « dans sa PR, pas en pushs concurrents » ; or `coordination/status/codex.md` est déjà sur l'intégration avec « SHA : voir commit », ce qui n'est pas un SHA. Proposition : Codex indique `c79f5c8` dans sa fiche à sa prochaine PR.
20. **G2 (mineur) —** CLAUDE.md demande d'utiliser l'identité donnée par l'utilisateur : cohérent avec AGENTS. Rien à corriger ; je note que l'ancien CLAUDE.md (identité fixée à Alexis) a bien été remplacé.

## Points solides

Règles concrètes et testables, séparation claire moteur pur / shell, déterminisme explicité (PRNG nommé, ticks entiers, pas de `Math.random`), interdits produit sains (pas de faux classement, pas d'achat de puissance), honnêteté sur l'absence de données. La répartition des chemins évite bien les conflits.

## Verdict

**CHANGES_REQUESTED** sur le contrat v0 avant gel : B1–B4 à intégrer (B1–B3 sont additifs et je les implémente côté shell dès qu'ils sont acceptés). Ces défauts **ne bloquent pas** le démarrage de F0 et A0 : M1–M8 peuvent être tranchés par FLK dans F0 et reportés ensuite dans CONTRACTS avec l'accord de Codex. Nouvelle revue requise sur le SHA corrigé.
