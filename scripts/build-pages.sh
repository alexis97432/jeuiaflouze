#!/usr/bin/env bash
# Construit le site GitHub Pages dans le dossier donné (défaut : pages-dist) et le vérifie.
# Usage : scripts/build-pages.sh [dossier]   — exécuté par .github/workflows/pages.yml
set -euo pipefail

OUT="${1:-pages-dist}"
BASE="/jeuiaflouze/"
SHA="$(git rev-parse HEAD)"

rm -rf dist "$OUT"
BUILD_ID="$(git rev-parse --short HEAD)" npx vite build --base="$BASE"
mkdir -p "$OUT"
cp -R dist/. "$OUT/"
printf '%s\n' "$SHA" > "$OUT/source-commit.txt"
touch "$OUT/.nojekyll"

# Vérifications : chaque ressource référencée par index.html est sous la base et existe ;
# aucun point d'inspection de test (window.__metrics) dans le build publié.
refs=$(grep -oE '(src|href)="[^"]+"' "$OUT/index.html" | sed -E 's/^(src|href)="([^"]+)"$/\2/')
[ -n "$refs" ] || { echo "index.html sans ressource" >&2; exit 1; }
for ref in $refs; do
  case "$ref" in
    "$BASE"*) file="$OUT/${ref#"$BASE"}"; [ -f "$file" ] || { echo "ressource absente : $ref" >&2; exit 1; } ;;
    *) echo "ressource hors base $BASE : $ref" >&2; exit 1 ;;
  esac
done
# Seul le JavaScript exécuté compte (la source map contient le texte source, normalement).
if grep -q "__metrics" "$OUT"/assets/*.js; then echo "__metrics présent dans le JS publié" >&2; exit 1; fi
echo "Site prêt dans $OUT pour $SHA"
