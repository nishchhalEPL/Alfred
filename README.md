# Alfred

Alfred is a macOS personal butler for deciding what deserves attention, planning the day, focusing, and reviewing real productivity — all locally, without an account or internet connection.

Personality: calm, discreet, practical. Recommendations come from a documented local scoring model, not from a remote model.

## Requirements

- macOS 12 or later
- Node.js 22 (this project was developed with Node 22.23.4)
- npm 10+

If Node is not on your PATH (Homebrew keg-only install):

```bash
export PATH="/opt/homebrew/opt/node@22/bin:$PATH"
```

## Setup

```bash
cd ~/Projects/alfred
npm install
npm run icon
```

## Run in development

```bash
npm run dev
```

This starts Vite on `http://localhost:5173` and opens the Electron shell.

## Checks

```bash
npm test
npm run typecheck
npm run lint
npm run format:check
```

## Production build and packaging

```bash
npm run build
npm run dist:mac
```

Unsigned artifacts are written to `release/`:

- `Alfred-1.0.0-arm64.dmg` (Apple Silicon)
- `Alfred-1.0.0-arm64.zip`

On Intel Macs, electron-builder may produce `x64` names instead.

To produce an unpackaged `.app` without a disk image:

```bash
npm run dist:mac:dir
```

The app can then be launched from `release/mac-arm64/Alfred.app` (or `release/mac/Alfred.app`) without the Vite dev server.

### Signing and notarization

This repository does **not** include Apple Developer certificates. Unsigned builds will show Gatekeeper warnings. To sign and notarize for distribution outside your own Mac:

1. Join the Apple Developer Program.
2. Create a Developer ID Application certificate.
3. Set `CSC_NAME` / `APPLE_ID` / `APPLE_APP_SPECIFIC_PASSWORD` / `APPLE_TEAM_ID` as described by [electron-builder](https://www.electron.build/code-signing).
4. Re-run `npm run dist:mac`.

Until then, right-click the app and choose Open, or run it from Terminal after a local build.

## Data, backup, and export

Alfred writes JSON to the macOS app support folder:

`~/Library/Application Support/Alfred/alfred-data.json`

(If the bundle id is honoured by Electron, this path is used. If you launched an unpackaged build, Electron may use `Electron/alfred-data.json` instead. Settings shows the exact path.)

Backup:

1. Quit Alfred.
2. Copy `alfred-data.json` somewhere safe.
3. Optionally use **Settings → Export JSON**.

Import replaces all local data after confirmation. Invalid files are rejected.

Sample tasks can be loaded and removed from Settings. Sample items are excluded from analytics.

There is **no cloud sync**.

## How recommendations work

See `shared/engine.ts` for weights. In short:

- Importance, deadline risk, energy match, in-progress work, and postponement risk all score a task.
- Incomplete dependencies, future start dates, deferral, and “unavailable” flags make a task ineligible no matter how high the score would be.
- If nothing fits remaining work time, Alfred suggests a smaller task or planning rather than pretending a long task will finish.

This is a transparent heuristic, not a claim of a unique optimum.

## Troubleshooting

- **`node` not found**: install Node 22 and add it to PATH (see above).
- **Blank window in development**: wait for Vite on port 5173; another app may be using that port.
- **Notifications missing**: enable them in Settings and in macOS System Settings → Notifications → Alfred.
- **Data looks empty after relaunch**: confirm you are opening the packaged app (or the same Electron userData) and check Settings for the file path.
- **Gatekeeper blocked the app**: expected for unsigned local builds; open from Finder with right-click → Open.
- **Import failed**: the file must be JSON produced by Alfred or matching its schema.

## Project layout

- `electron/` — main process, preload, JSON persistence
- `shared/` — types, engine, scheduler, timer, analytics, validation
- `src/` — React interface
- `tests/` — unit tests for high-risk logic
- `resources/` — app icon
