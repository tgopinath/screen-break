# Screen Break

**Pitch:** Eye-rest and movement reminders that work around your day, not against it.

**Description:** Screen Break reminds people who work at a screen to rest their eyes (20-20-20), move, check posture and drink water, then gets out of the way. Every reminder has an absolute due time, nearby reminders combine into one break, focus mode holds everything but eye rest, and sleep, lunch and out-of-hours restart timers instead of firing a backlog. One React codebase runs as a website, as a macOS menu bar / Windows tray app (Electron) and inside Android and iPhone shells with native Material 3 and Apple HIG looks.

**Tags:** Health, Productivity, Desktop app, Electron, React, Android, iOS

- Live: https://screen-break-nine.vercel.app
- APK: https://github.com/tgopinath/screen-break/releases/latest/download/screen-break.apk (4.1 MB, Android 7+, opens the live site)
- macOS DMG: https://github.com/tgopinath/screen-break/releases/latest/download/screen-break.dmg (125 MB, Apple Silicon only, ad-hoc signed, not notarised: right-click > Open the first time)
- iOS: https://github.com/tgopinath/ScreenBreak-iOS (SwiftUI WKWebView shell; Simulator screenshots, no TestFlight)
- Repo: https://github.com/tgopinath/screen-break
- Stack: React 19, TypeScript, Vite 8, Tailwind 4, Electron 45 + electron-builder, Vitest (28 scheduler/engine tests), Web Audio chimes (synthesised), localStorage. Native looks via the Kolam M3 kit (Android app) and Kolam iOS kit (iPhone app), loaded only on the web build.
- Status: live, v1.0.0. Not on Kolam (own calm green design, Plus Jakarta Sans). Phone shells use in-app prompts (no system notifications in a WebView).
- Assets: prototype/mobile.html, prototype/shots/{onboarding,dashboard,break,stats,settings}.jpg, prototype/shots/web.jpg (1440x900), prototype/icon.png. Re-shoot: node tools/shots.mjs (shoots at about 11:00 local time).
