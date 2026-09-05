# Architecture

Mappie 0.2 separates sensor collection from personal cartography. The only platform-specific layer acquires location observations; every transformation after that is ordinary TypeScript.

## Runtime flow

```text
expo-location                         GPX document picker
      |                                      |
      v                                      v
LocationObject -> TrackPoint          XML -> TrackPoint[]
      |                                      |
      +------------------+-------------------+
                         |
                         v
                 filterTrackPoints
                         |
                         v
              versioned local archive
                         |
                         v
       simplify -> resample -> spatial snap
                         |
                         v
               observed edge graph
                         |
                         v
                 metric projection
                         |
                         v
                 react-native-svg
```

## Boundaries

`src/core`

Pure geospatial and interchange logic. It parses GPX, measures Haversine distance, rejects bad observations, splits interrupted sessions, reconstructs a visited edge graph, and projects latitude/longitude into a fitted local metric plane. These modules are covered by Vitest and can run without Expo.

`reconstruction.ts` is the current baseline map builder. It applies Ramer-Douglas-Peucker simplification, resamples long segments at a fixed metric interval, and snaps observations within a bounded radius into shared nodes. Edges record the first and last session that observed them, distinct-session visit counts, and per-session new versus revisited distance. A length-weighted confidence score rises across the first three independent observations of an edge.

`src/services`

Platform adapters. `location.ts` translates Expo location objects into the core `TrackPoint` type and owns the top-level background task. `storage.ts` owns the versioned AsyncStorage keys and serializes background writes so batches cannot overwrite one another within a process.

`src/state`

The exploration lifecycle. It hydrates saved data, resumes a background session, merges buffered observations when the app returns to the foreground, filters a finished session, and commits it to the archive.

`src/components`

The code-native cartography surface and controls. `MapCanvas` receives tracks rather than a map-provider object. It therefore cannot accidentally reveal roads that the user has not explored.

`src/data`

The isolated public reconstruction scenario. Seventy attributed OSM GPS sessions are cropped to the same fixed Cambridge bounding box, retaining genuine overlap, branches, loops, and positioning drift. The fixtures are never written into the private archive.

## Track schema

```ts
interface TrackPoint {
  latitude: number;
  longitude: number;
  timestamp: number;
  accuracy?: number;
  elevation?: number;
  segmentStart?: boolean;
}

interface Track {
  id: string;
  name: string;
  source: "demo" | "gpx" | "live";
  createdAt: number;
  points: TrackPoint[];
}
```

The archive wraps tracks in `{ version: 1 }` so a later SQLite importer can distinguish schema changes. The bundled demo is never written into the personal archive.

## Observation filter

The default walking filter rejects:

- coordinates outside valid latitude/longitude ranges;
- horizontal accuracy worse than 50 meters;
- observations that move less than 2 meters from the last accepted point;
- observations implying speed above 12 meters per second;
- observations whose timestamp does not advance.

GPX points without an accuracy value remain eligible. This is deliberate: GPX does not provide a portable horizontal-accuracy field, and existing exported histories should still import.

These thresholds are prototype defaults, not claims of universal correctness. Cycling, driving, dense urban canyons, and parallel paths will require activity profiles and a probabilistic map matcher.

## Background lifecycle

1. `EXPLORE` requests foreground location permission and creates an empty active track.
2. Native builds request background permission and register `mappie-background-location-v1` when granted.
3. Foreground observations update the visible active track and its recovery snapshot.
4. Background batches append to a serialized buffer in local storage.
5. Returning to the foreground drains that buffer into the active track.
6. `STOP` halts both subscriptions, filters merged observations, and commits a valid track.

The foreground watcher remains active while the background task is registered so the UI updates immediately. Duplicate observations are removed by the movement filter when the session is finalized.

## Next storage model

Production map matching will change the durable model from only raw trajectories to two related stores:

```text
private_observations(track_id, time, lat, lon, accuracy)
inferred_edges(edge_id, from_node, to_node, first_seen, last_seen, visit_count)
```

Rendering can then depend on `inferred_edges`, while users may choose to delete precise raw observations. The current in-memory graph is rebuilt deterministically and is not yet persisted.
