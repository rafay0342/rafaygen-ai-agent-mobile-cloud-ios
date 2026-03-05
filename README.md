# RafayGen AI Android Client

Android-ready multi-screen client app with drawer, themes, pricing/payment flow, API-key auth session, and backend endpoint testing.

## Features
- Dashboard, Auth Session, AI Agent, Pricing, Payment, Settings screens
- Drawer opens via menu button and swipe gesture
- Themes: Light / Dark / Light-Skin
- Runtime-configurable API base URL, API key, and payment URL
- Native HTTP path on Android via Capacitor HTTP (better compatibility for remote APIs)
- Endpoint wiring:
  - `GET /api/models`
  - `POST /api/chat`
- AI Agent screen has `Test All Models` smoke test for quick model health validation.
- Failed/unsupported models are auto-marked and hidden by default in the model selector.
- Strict model mode enabled for chat tests (`strictModel` / `options.strict_model`) so selected model is not auto-routed to another model.

## Build Android release
1. `npm install`
2. `npm run android:init` (first time)
3. `npm run android:release`

Outputs:
- `android/app/build/outputs/apk/release/app-release.apk`
- `android/app/build/outputs/bundle/release/app-release.aab`

## Build iOS (unsigned IPA)
1. Install full Xcode from App Store.
2. Select Xcode tools:
   - `sudo xcode-select -s /Applications/Xcode.app/Contents/Developer`
3. In project:
   - `npm run ios:init` (first time only)
   - `npm run ios:build:unsigned`

iOS unsigned output:
- `release-artifacts/ios/rafaygen-ai-agent-unsigned.ipa`
- `release-artifacts/ios/SHA256SUMS-ios.txt`

Note:
- File extension is `.ipa` (not `.ips`).
- Unsigned IPA cannot be directly installed on normal iPhones; signing is required in Xcode/Apple Developer flow.

## Build iOS in cloud (without local Xcode)
- Workflow file: `.github/workflows/ios-unsigned-ipa.yml`
- Full guide: `CLOUD_IOS_BUILD.md`
- Output artifact from GitHub Actions:
  - `rafaygen-ai-agent-unsigned.ipa`
  - `SHA256SUMS-ios.txt`

## Model validation (all models)
- `npm run models:test -- http://72.62.1.63:3000 YOUR_API_KEY`
- This runs `/api/models` then smoke-tests each model with `/api/chat`.
