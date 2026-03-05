# Cloud iOS Build (No Local Xcode)

Use GitHub Actions to build unsigned iOS IPA on macOS runner.

## One-time setup
1. Push this project to a GitHub repository.
2. Ensure workflow exists:
   - `.github/workflows/ios-unsigned-ipa.yml`
3. Commit iOS folder (`ios/`) and scripts.

## Run build
1. Open GitHub repo -> Actions.
2. Select **iOS Unsigned IPA Build**.
3. Click **Run workflow**.

## Download output
After success, download artifact:
- `rafaygen-ai-agent-ios-unsigned`

Inside artifact:
- `rafaygen-ai-agent-unsigned.ipa`
- `SHA256SUMS-ios.txt`

## Notes
- Unsigned IPA is useful for packaging/CI validation.
- Real install/TestFlight/App Store requires signed archive from Xcode + Apple Developer account.
