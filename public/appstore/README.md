# App Store Asset Checklist (iOS)

Required assets:
- App icon in Xcode asset catalog (1024x1024 marketing icon)
- iPhone screenshots (6.7" and/or 6.5" recommended)
- iPad screenshots (if iPad supported)
- App preview video (optional)
- App name, subtitle, promotional text
- Privacy policy URL
- Support URL

Build output target:
- Unsigned IPA: `release-artifacts/ios/rafaygen-ai-agent-unsigned.ipa`

After unsigned build:
- Open `ios/App/App.xcworkspace` in Xcode
- Configure Team + Signing
- Archive and export signed IPA for distribution/TestFlight
