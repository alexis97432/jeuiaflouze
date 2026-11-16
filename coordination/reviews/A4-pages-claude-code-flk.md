# Revue A4 (partie indépendante) — workflow manuel GitHub Pages — Claude Code FLK

- **Tâche :** [alexis97432/jeuiaflouze#21](https://github.com/alexis97432/jeuiaflouze/pull/21)
- **Auteur :** claude-code-alexis · **Reviewer :** claude-code-flk
- **SHA revu :** `e02aedb0345c4f16e9fcff24b8b110c5f33e125a` (base intégration `ebced6b`), sur un worktree détaché.
- **Périmètre lu intégralement :** `.github/workflows/pages.yml`, `scripts/build-pages.sh`, `.gitignore`, description de la PR.

## Vérifications réelles (16 novembre 2026, Node 22.23.4, aucun push)

- `npm ci` (0 vulnérabilité), puis `scripts/build-pages.sh` : exit 0. Le site contient `index.html`, `assets/`, `.nojekyll` et `source-commit.txt` (= `e02aedb…`, le SHA complet).
- **Garde-fou** : le même script avec `VITE_EXPOSE_METRICS=1` sort en **code 1**. Le build publié ne peut donc pas contenir `window.__metrics`.
- **Site servi sous `/jeuiaflouze/`**, comme sur GitHub Pages (serveur local qui refuse tout chemin hors base), joué dans Chromium avec le profil Pixel 7 :
  - accueil et partie complète jusqu'au résultat, sans erreur de page ;
  - aucune ressource introuvable ni hors base ;
  - le lien de défi généré garde la base (`…/jeuiaflouze/?v=1&seed=…&target=…`), et ouvert dans un autre onglet il affiche bien l'invitation.
- **Étape de publication simulée** deux fois sur une copie locale de `origin/gh-pages` (worktree jetable, aucun push) :
  - **1re** : commit ; seuls `index.html`, les assets et `source-commit.txt` changent, `.nojekyll` est conservé ;
  - **2e, même SHA** : `git commit` échoue (« nothing to commit », code 1). Voir m1.
- **Sécurité du workflow** :
  - seul déclencheur `workflow_dispatch` ;
  - `inputs.ref` n'est utilisé que dans `with: ref` d'`actions/checkout`, jamais interpolé dans un script shell, donc **pas d'injection de commande** ;
  - commit refusé s'il n'est pas ancêtre de la branche d'intégration ;
  - `permissions: contents: write` seulement ;
  - `concurrency` sans annulation.

## Défauts

Aucun bloquant.

**m1 — mineur (`pages.yml`, étape « Publier sur la branche gh-pages »).** Republier un SHA déjà publié fait échouer `git commit`, faute de changement. Cela arrive justement quand on relance le workflow après un échec de l'étape de vérification en ligne (réglage Pages corrigé entre-temps, par exemple) : la relance échoue avant d'atteindre la vérification. Suggestion : `git diff --cached --quiet && echo "Déjà publié : $SHA" || { git commit … && git push …; }`, puis la vérification en ligne dans tous les cas.

**i1 — information.** Les source maps (`assets/*.js.map`) sont publiées. Le dépôt et le code ne sont pas secrets, donc c'est acceptable et utile au débogage sur téléphone. Il faut simplement que ce soit un choix conscient. Il suffirait de passer `build.sourcemap` à `false` pour Pages si l'on préfère un site plus léger.

**i2 — information.** La première exécution réelle sur GitHub Actions (push avec `GITHUB_TOKEN`, reconstruction Pages) n'a pas pu être vérifiée ici, comme le dit la PR. L'étape de vérification en ligne la rendra observable. Elle publiera l'état de l'intégration au moment du lancement : y faire figurer F3/F4/A3, puis A4 branché, suppose leurs PASS et leur intégration préalables.

## Verdict

**PASS** sur `e02aedb0345c4f16e9fcff24b8b110c5f33e125a`. m1 est souhaitable avant le premier lancement réel. Ce PASS ne couvre aucun SHA ultérieur.
