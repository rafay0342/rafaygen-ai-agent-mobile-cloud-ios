#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
APP_NAME="App"
IOS_DIR="${ROOT_DIR}/ios/App"
OUT_DIR="${ROOT_DIR}/release-artifacts/ios"
BUILD_DIR="${IOS_DIR}/build"
PAYLOAD_DIR="${OUT_DIR}/Payload"
APP_PATH="${BUILD_DIR}/Build/Products/Release-iphoneos/${APP_NAME}.app"
IPA_PATH="${OUT_DIR}/rafaygen-ai-agent-unsigned.ipa"
SKIP_SYNC="${SKIP_SYNC:-0}"
XCODE_TARGET=()

mkdir -p "${OUT_DIR}"

if ! command -v xcodebuild >/dev/null 2>&1; then
  echo "ERROR: xcodebuild not found. Install full Xcode first."
  exit 1
fi

if [ ! -d "${IOS_DIR}" ]; then
  echo "ERROR: iOS project not found at ${IOS_DIR}. Run: npm run ios:init"
  exit 1
fi

if [ "${SKIP_SYNC}" != "1" ]; then
  pushd "${ROOT_DIR}" >/dev/null
  npm run ios:sync
  popd >/dev/null
fi

if [ -d "${IOS_DIR}/${APP_NAME}.xcworkspace" ]; then
  XCODE_TARGET=(-workspace "${APP_NAME}.xcworkspace")
elif [ -d "${IOS_DIR}/${APP_NAME}.xcodeproj" ]; then
  XCODE_TARGET=(-project "${APP_NAME}.xcodeproj")
else
  echo "ERROR: Could not find ${APP_NAME}.xcworkspace or ${APP_NAME}.xcodeproj in ${IOS_DIR}"
  exit 1
fi

pushd "${IOS_DIR}" >/dev/null

xcodebuild \
  "${XCODE_TARGET[@]}" \
  -scheme "${APP_NAME}" \
  -configuration Release \
  -destination "generic/platform=iOS" \
  -sdk iphoneos \
  -derivedDataPath "${BUILD_DIR}" \
  clean build \
  CODE_SIGNING_ALLOWED=NO \
  CODE_SIGNING_REQUIRED=NO \
  CODE_SIGN_IDENTITY="" \
  DEVELOPMENT_TEAM=""

popd >/dev/null

if [ ! -d "${APP_PATH}" ]; then
  echo "ERROR: Unsigned app not produced at ${APP_PATH}"
  exit 1
fi

rm -rf "${PAYLOAD_DIR}"
mkdir -p "${PAYLOAD_DIR}"
cp -R "${APP_PATH}" "${PAYLOAD_DIR}/${APP_NAME}.app"

pushd "${OUT_DIR}" >/dev/null
zip -qry "$(basename "${IPA_PATH}")" Payload
popd >/dev/null

rm -rf "${PAYLOAD_DIR}"

echo "Unsigned IPA generated: ${IPA_PATH}"
shasum -a 256 "${IPA_PATH}" > "${OUT_DIR}/SHA256SUMS-ios.txt"
echo "SHA256 written: ${OUT_DIR}/SHA256SUMS-ios.txt"
