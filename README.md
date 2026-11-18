# Screen Break

Eye rest & movement reminders. Work better. Rest your eyes. Move your body.

One React + TypeScript codebase runs as a web app and as a macOS / Windows desktop app (Electron) with a menu bar / system tray popover.

## Run

```bash
npm install
npm run dev            # web app at http://localhost:5173
npm run electron:dev   # desktop app against the Vite dev server
npm run electron:start # desktop app from a production build
npm test               # scheduler / engine unit tests (Vitest)
```

## Package

```bash
npm run dist:mac   # .dmg + .zip in release/
npm run dist:win   # NSIS installer (run on Windows or with Wine)
CSC_IDENTITY_AUTO_DISCOVERY=false npm run dist:dir   # quick unsigned local build
```

`build/icon.png` is generated from code: `node scripts/make-icon.cjs`.

## Architecture

| Module (spec name) | Where |
|---|---|
| TimerEngine / ReminderScheduler | `src/lib/scheduler.ts` (pure rules) + `src/lib/engine.ts` (runtime) |
| NotificationManager | `src/lib/notifications.ts`, native side in `electron/main.cjs` |
| Eye / Movement exercise managers | `src/lib/exercises.ts` |
| FocusSessionManager, ActivityTracker | `src/lib/engine.ts` (focus + work sessions) |
| AnalyticsEngine | `src/lib/analytics.ts` |
| SettingsManager / StorageManager | `src/lib/defaults.ts`, `src/lib/storage.ts` |
| Working schedule | `src/lib/schedule.ts` |
| SystemTrayManager | `electron/main.cjs`, popover UI `src/pages/TrayView.tsx` |
| Types | `src/lib/types.ts` |

Key design decisions:

- **Timestamps, not intervals.** Every reminder has an absolute `dueAt`. The 1-second tick only compares against `Date.now()`, so throttled or hidden windows never drift.
- **One scheduler.** The engine runs only in the main window (kept alive and unthrottled when hidden). The tray popover just mirrors a snapshot relayed by the main process, so duplicate timers are impossible.
- **No notification loops.** While a prompt is open its timers are held. Unanswered prompts become "missed" after 2 minutes and reschedule.
- **Combining.** Reminders due within 2 minutes of each other join one break (eye → movement → posture → hydration).
- **Sleep / away / outside hours** restart timers fresh instead of firing overdue reminders. A manual pause restores the remaining time.
- **Focus mode** holds everything except eye rest. Held reminders fire together when focus ends.
- **Analytics are derived only from recorded history.** Empty ranges show "—" or "No data recorded".

## Test mode

Settings → General → Developer → Test mode: intervals become 10–30 s (minutes read as seconds), snooze becomes 10 s, focus sessions run in seconds.

## Desktop self-test

`SB_SELFTEST=/some/dir npx electron .` (add `SB_DEV_URL=...` for dev). It runs in a throwaway profile, drives the tray, close-to-tray, pause/resume, power events and a break, then writes screenshots and `report.json`.
