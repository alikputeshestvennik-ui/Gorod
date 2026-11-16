---
name: android-apk-build
description: Packaging the web game into an Android APK with Capacitor and building/signing it in GitHub Actions, for an owner who has only a phone. Use for any APK, Gradle, Capacitor, CI workflow, signing key, app icon, permissions or "how do I install it" task.
---

# Android APK via GitHub Actions

The owner has NO computer. The APK must come out of CI as a downloadable artifact; never require local builds.

## Setup
- Capacitor: `@capacitor/core`, `@capacitor/cli`, `@capacitor/android`. App id like `ru.alim.gorodskoy`, name «Городской маршрут». `webDir` = Vite `dist`.
- Commit the generated `android/` folder to the repo.
- Orientation: allow both; fullscreen/immersive; keep screen on while playing.
- Permissions: none (offline game). Do not add INTERNET unless a feature truly needs it.
- Icons/splash: generate simple ones from a single SVG; commit the result.

## CI
Use `references/android.yml` as the starting workflow (copy to `.github/workflows/android.yml`).
- Runs on push to main and manually (`workflow_dispatch`).
- Steps: checkout → Node → Java → `npm ci` → `npm test` → `npm run build` → `npx cap sync android` → Gradle build → upload APK artifact.
- Check the Capacitor docs for the JDK version required by the installed Capacitor major version and set `java-version` accordingly.

## Signing
- Debug APK is fine for personal testing and installs on his phone.
- For a signed release: keystore stored base64 in GitHub Secrets (`KEYSTORE_BASE64`, `KEYSTORE_PASSWORD`, `KEY_ALIAS`, `KEY_PASSWORD`), decoded in CI. Never commit a keystore or passwords. If the repository already has a signing setup (e.g. in the owner's other Android app), reuse the same secrets/approach.

## Telling the owner how to install
Final message must say, in simple Russian: open the repo on GitHub in the phone → Actions → latest run → Artifacts → download → unzip/open APK → allow installing from this source. Keep it 4–5 short steps.

## When the build fails
Read the failing step's log, fix the cause, re-run. Do not disable tests to make the build green. Report the cause in one sentence.
