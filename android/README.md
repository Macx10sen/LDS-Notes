# LDNotebook for Android

A small native Android app that shows Latter Day Notebook in its own WebView, so
it runs without Chrome. App blockers and screen-time tools see it as
**LDNotebook**, not Chrome.

- **Updates:** it loads the live site (`https://macx10sen.github.io/LDS-Notes/`), so changes to the notebook reach the app without reinstalling. The site's service worker keeps it working offline after the first launch.
- **Native features:** the page calls `window.LDNotebook` for Android's share sheet (Share and Back up) and to color the status and navigation bars from the Appearance setting.
- **Notes:** stored inside the app, separate from Chrome's copy. Move them with Back up / Restore.

## Getting the APK

GitHub Actions (`.github/workflows/android.yml`) builds the APK. Pull requests that touch `android/` build it as a check. Every push to `main` that touches `android/` also publishes a release. The latest APK is always at:

https://github.com/Macx10sen/LDS-Notes/releases/latest/download/LDNotebook.apk

Changes to the website itself don't need a new APK.

## Signing key

Android only installs an update when it's signed with the same key as the installed app. The key is kept out of this public repo, in two repository secrets (Settings → Secrets and variables → Actions):

| Secret | Value |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | the keystore file, base64-encoded |
| `ANDROID_KEYSTORE_PASSWORD` | the keystore and key password (key alias `ldnotebook`) |

Without them, CI still builds a test-signed APK to check that it compiles, but doesn't publish it. Keep a private copy of the keystore. If it's lost, the next APK can't update the installed app, so you'd have to back up your notes, uninstall, and reinstall.

## Building locally

Needs JDK 17 and the Android SDK (platform 34):

```sh
cd android
ANDROID_KEYSTORE_FILE=/path/to/ldnotebook.keystore ANDROID_KEYSTORE_PASSWORD=... ./gradlew assembleRelease
# → app/build/outputs/apk/release/app-release.apk
```
