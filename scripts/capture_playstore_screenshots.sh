#!/usr/bin/env bash
set -euo pipefail

OUT_DIR="$(cd "$(dirname "$0")/../public/playstore/screenshots" && pwd)"
TS="$(date +%Y%m%d-%H%M%S)"

adb devices | sed -n '1,5p'

for i in 1 2 3 4; do
  adb shell screencap -p "/sdcard/rg-shot-${i}.png"
  adb pull "/sdcard/rg-shot-${i}.png" "${OUT_DIR}/phone-${i}-${TS}.png"
  adb shell rm "/sdcard/rg-shot-${i}.png"
  echo "Saved screenshot ${i}"
done

echo "Screenshots exported to: ${OUT_DIR}"
