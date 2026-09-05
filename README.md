<p align="center">
  <img src="assets/mappie-icon.png" width="128" alt="Mappie route icon">
</p>

# Mappie

**The world is blank until you walk through it.**

Mappie is an open-source personal cartography experiment. Instead of showing a complete map and drawing a workout on top, it starts with an empty field and renders only the paths that have entered your own history.

<p align="center">
  <img src="docs/mappie-mobile.png" width="390" alt="Mappie replaying a public walking trace on its blank map">
</p>

The interaction is inspired by the fictional GPS tool named Mappie in the visual novel _Rewrite_: movement builds knowledge of the map, and the edge of that knowledge is where discoveries can eventually appear. This project is independent and is not affiliated with or endorsed by Key or Visual Arts. It contains no assets from the game.

## What works

- A blank, pan-and-zoom vector canvas with no commercial basemap
- Animated gallery of six real, public walking, hiking, running, and cycling traces
- Rewrite-inspired `!` target, proximity-revealed `?` and person signals, and Memory state
- GPX 1.1 track and route import
- Foreground GPS recording on iOS, Android, and compatible browsers
- Background GPS buffering in iOS/Android development builds
- Local-only archive and interrupted-session recovery
- Accuracy, speed, movement, and timestamp filtering
- Distance, location-fix, session, and live-state telemetry
- Responsive layouts tested at desktop and iPhone dimensions

The public trace gallery makes the central loop testable without a physical phone. Use the arrow controls to compare six route shapes, open optional signals before reaching `!`, and switch to `MY MAP` for imported or recorded paths. Personal routes never mix with the bundled demo archive.

## Quick start

Requirements: Node.js 20 or newer and npm.

```bash
npm install
npm run web
```

Open `http://localhost:8081` when Expo is ready. The web build can replay the fixture, import GPX files, and collect foreground browser geolocation when the page is served from localhost or HTTPS.

For an iPhone, install Expo Go and run:

```bash
npm start
```

Scan the QR code from Expo Go. GPX import and foreground recording work there. Background location is intentionally not advertised as working in Expo Go because iOS requires an Expo development build for `TaskManager` background execution.

On macOS with Xcode, create a native development build with:

```bash
npx expo prebuild --platform ios
npx expo run:ios --device
```

The app config already declares the `location` background mode and human-readable permission copy. An Apple Developer signing identity is still required to install a native build on a physical device.

## Verification

```bash
npm run typecheck
npm test
npm run test:e2e
npx expo export --platform web
```

The unit suite covers GPX parsing, GPS rejection rules, distance measurement, time-gap segmentation, viewport projection, and the public route registry. The Playwright suite boots the real web bundle at desktop and iPhone dimensions, opens a discovery, changes public routes, checks horizontal overflow, and exercises the map-mode switch.

## Architecture

```text
Core Location / browser geolocation / GPX
                    |
                    v
          quality and motion filter
                    |
                    v
       local exploration archive (v1)
                    |
                    v
      projection -> blank SVG cartography
```

The `src/core` modules have no React Native imports. This keeps parsing, filtering, distance, and rendering geometry independently testable and leaves a clean boundary for a future Rust or native map-matching engine.

See [Architecture](docs/architecture.md) for lifecycle details and the planned road-graph model.

## Privacy model

- No account, analytics, server, advertising SDK, or remote map provider
- Recorded and imported paths stay in the app's local storage
- Background recording starts only from the explicit `EXPLORE` command
- The iOS background-location indicator is enabled
- Clearing `MY MAP` removes the archive, active track, and background buffer

AsyncStorage is suitable for the current prototype. Before storing large histories or an OpenStreetMap edge graph, the archive will move to SQLite with a migration path from schema version 1.

## Public test data

The gallery contains six OpenStreetMap GPS traces whose source pages were explicitly marked `PUBLIC`. Long traces are sampled to 240 ordered points for mobile replay while their original point counts remain visible in the UI.

Fixture data is provided under the Open Database License 1.0 with attribution to OpenStreetMap contributors. Application source code is separately licensed under MIT. See [Data attribution](docs/data-attribution.md).

See [Rewrite Mappie reference](docs/rewrite-reference.md) for the source-backed interaction analysis, the fidelity assessment, and the deliberate mobile adaptations.

## Roadmap

- Persist large archives and spatial indexes in SQLite
- Import and export complete archives as GPX/GeoJSON
- Map-match GPS observations against cached OpenStreetMap road edges
- Store explored edge identifiers separately from raw private trajectories
- Persist demo-style `UNKNOWN -> DISCOVERED -> KNOWN` state on personal maps
- Add private quest dependencies and user-authored people/POI annotations
- Compute neighborhood coverage without streaks or leaderboards
- Add battery-aware deferred collection presets and Apple Watch capture

The first milestone deliberately stops before map matching. A raw trail on an empty field is enough to test whether personal map growth is compelling; road knowledge and discovery semantics can then grow behind that proven interaction.
