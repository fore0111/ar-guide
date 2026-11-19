#!/bin/sh
# 地図モックと AR ガイドを公開用リポジトリ（fore0111/nasvi-mock、GitHub Pages）の作業ツリーへ配置する。
# 使い方: sh mock/deploy.sh [出力先]   （既定: hackson/nasvi-mock）→ 出力先で commit・push
set -eu
SRC=$(cd "$(dirname "$0")/.." && pwd)
OUT=${1:-"$SRC/../nasvi-mock"}
mkdir -p "$OUT/data"
sed -e "s#const PATHS = { data: '../data/', ar: '../index.html' };#const PATHS = { data: 'data/', ar: 'ar.html' };#" \
    -e 's#href="../index.html"#href="ar.html"#g' "$SRC/mock/index.html" > "$OUT/index.html"
# 画像認識版（image.html）は公開対象外のため、AR ガイドからの導線を削除
sed -e '/<a href="image.html">/d' "$SRC/index.html" > "$OUT/ar.html"
cp "$SRC/data/buildings.json" "$SRC/data/events.json" "$OUT/data/"
touch "$OUT/.nojekyll"
grep -q "ar: 'ar.html'" "$OUT/index.html" || { echo "参照先の書き換えに失敗" >&2; exit 1; }
echo "配置完了: $OUT"
