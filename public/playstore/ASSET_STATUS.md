# Asset Status

Included:
- Signed APK/AAB release files
- App icons from Android launcher resources
- Store listing template text
- Screenshot capture script for real-device store screenshots

Generate screenshots:
1. Install release APK on device/emulator.
2. Open app and navigate key screens: Dashboard, Agent, Pricing, Payment, Settings.
3. Run: `scripts/capture_playstore_screenshots.sh`
4. Upload generated PNG files from `public/playstore/screenshots` to Play Console.
