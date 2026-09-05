# Firefox replay performance

This note records the first large-session performance incident in Mappie: what
failed, why it failed, what changed, and how the result was measured. It is a
baseline for future work with hundreds or thousands of exploration sessions.

## Original symptom

With the 70-session Cambridge fixture, Firefox began visibly freezing around
session 30. The reconstructed map was still correct, but input and animation
were interrupted by repeated main-thread stalls.

The initial implementation represented every inferred edge as its own React
`<G>` and SVG `<Path>`. Current and newly observed edges could add a second glow
path. At session 31 this produced 2,323 paths and 2,312 groups; at session 70 the
SVG tree contained 2,985 paths and 2,977 groups.

Three costs compounded during playback:

1. React and Firefox reconciled thousands of SVG nodes whenever geometry
   changed.
2. Every frame recomputed the projection bounds from all 14,510 fixture points,
   even though the demo viewport never changed.
3. Each animated slice reconstructed all previous sessions and regenerated the
   edge-tone index instead of treating the completed network as stable.

## Solution

### Batch by visual state

[`MapCanvas`](../src/components/MapCanvas.tsx) now concatenates every segment of
the same visual state into one compound SVG path. `raw`, `observed`, `confirmed`,
`new`, and `current` remain separate layers, so their ordering, opacity, width,
and color are unchanged while the DOM cost depends on the number of styles
rather than the number of inferred edges.

### Cache the fitted viewport

[`projection.ts`](../src/core/projection.ts) separates fitting from projection.
`fitTrackViewport` computes the stable Cambridge viewport only when the canvas
size or fitting tracks change. `projectTracksToViewport` then projects only the
geometry that is currently visible.

### Separate survey playback from map commit

[`MappieScreen`](../src/MappieScreen.tsx) keeps previously committed edges
static while the current raw GPS survey plays over them. Replay state advances
only on meaningful geometry frames. When the survey finishes, the session is
reconstructed once and committed to the inferred network.

This is both faster and more causally correct: `NEW`, `REVISIT`, confidence, and
confirmed-edge colors do not reveal the result of a survey before that survey
has finished.

Stable canvas props and edge-tone maps are memoized, and `MapCanvas` is wrapped
in `React.memo` so unrelated telemetry renders do not rebuild the SVG surface.

## Measured result

The comparison was recorded on 2026-09-05 with Playwright 1.62.1, its bundled
Firefox 153, a headless Linux browser, a 1280 x 800 viewport, and the Expo
development server on localhost. The frame sample counts delivered
`requestAnimationFrame` callbacks over the same 3.5-second interval at session 31. These numbers are environment-specific; their value is the before/after
comparison under the same setup.

| Session 31 animation metric | Before | After |
| --------------------------- | -----: | ----: |
| Delivered frames in 3.5 s   |     24 |   206 |
| Maximum frame gap           | 300 ms | 33 ms |
| Frame gaps above 50 ms      |     22 |     0 |
| SVG descendants             |  4,706 |    88 |
| SVG paths                   |  2,323 |    13 |
| SVG groups                  |  2,312 |     4 |

At session 70, total SVG descendants fell from 6,033 to fewer than 90. The final
mobile Firefox capture contained 62 SVG descendants and 12 paths.

The 3.5-second animation sample deliberately ends before map commit. A separate
five-second full-lifecycle sample included the final merge: 283 frames were
delivered, with two gaps above 50 ms and a maximum gap of 116 ms. That remaining
peak is one reconstruction at the commit boundary, not recurring playback
jank. An incremental graph builder or worker is the next step if that single
merge becomes noticeable with much larger personal archives.

## Regression protection

Playwright now runs the real application in desktop Chromium, desktop Firefox,
and an iPhone-sized Chromium viewport. The scenario advances beyond session 30,
checks the `SURVEY IN PROGRESS` to committed transition, and fails if the SVG
tree grows to 150 descendants. CI installs and exercises both browser engines.

The DOM ceiling catches the original failure mode deterministically. Timing is
kept as an explicit profiling measurement rather than a hard CI assertion,
because shared-runner frame timing is too noisy for a stable pass/fail threshold.

## Reproduce the profile

Install Firefox for Playwright once, start the development server, and run the
profile in another terminal:

```bash
npx playwright install firefox
npm run web
npm run profile:firefox
```

Set `MAPPIE_URL` to profile a server on a different origin:

```bash
MAPPIE_URL=http://127.0.0.1:8090 npm run profile:firefox
```

The command reports session-31 animation timing and the session-31/session-70
SVG node counts as JSON. Keep the browser, viewport, server mode, and machine
consistent when comparing changes.
