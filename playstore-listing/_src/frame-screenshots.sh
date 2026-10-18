#!/bin/bash
# Frames raw phone screenshots (playstore-listing/raw/*.png|jpg, taken in order)
# into 1080x1920 (9:16) Play Store images with a caption from captions.txt.
# Output: playstore-listing/screenshots/01.png, 02.png, ...
set -euo pipefail
HERE="$(cd "$(dirname "$0")/.." && pwd)"; ROOT="$(cd "$HERE/.." && pwd)"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
FONT="$ROOT/node_modules/@expo-google-fonts/poppins/600SemiBold/Poppins_600SemiBold.ttf"
mkdir -p "$HERE/screenshots"; rm -f "$HERE/screenshots/"*.png
i=0
while IFS= read -r -d '' img; do
  i=$((i+1)); n=$(printf %02d $i)
  cap=$(sed -n "${i}p" "$HERE/_src/captions.txt")
  html="$HERE/_src/.frame-$n.html"
  cat > "$html" <<HTML
<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:P;src:url('file://$FONT')}
html,body{margin:0;width:1080px;height:1920px;overflow:hidden}
.c{width:1080px;height:1920px;background:#0003D5;display:flex;flex-direction:column;align-items:center;box-sizing:border-box;padding-top:110px;position:relative;overflow:hidden}
.pat{position:absolute;inset:0;background:url('file://$ROOT/assets/brand/brand-pattern-white.webp') center/cover;opacity:.07}
h1{position:relative;color:#fff;font-family:P;font-weight:600;font-size:64px;line-height:1.2;text-align:center;margin:0 80px 70px}
.ph{position:relative;flex:1;min-height:0;display:flex;justify-content:center;align-items:flex-start}
.ph img{height:1520px;border-radius:48px;border:14px solid #141414;box-shadow:0 30px 80px rgba(0,0,0,.35)}
</style></head><body><div class="c"><div class="pat"></div><h1>$cap</h1>
<div class="ph"><img src="file://$img"></div></div></body></html>
HTML
  "$CHROME" --headless=new --disable-gpu --hide-scrollbars --allow-file-access-from-files \
    --force-device-scale-factor=1 --window-size=1080,1920 \
    --screenshot="$HERE/screenshots/$n.png" "file://$html" 2>/dev/null
  rm -f "$html"
  echo "$n.png  <- $(basename "$img")  \"$cap\""
done < <(find "$HERE/raw" -maxdepth 1 \( -iname '*.png' -o -iname '*.jpg' -o -iname '*.jpeg' \) -print0 | sort -z)
[ $i -eq 0 ] && echo "No screenshots in $HERE/raw" || echo "Done: $i framed into $HERE/screenshots"
