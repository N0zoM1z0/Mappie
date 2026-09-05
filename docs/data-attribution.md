# Data attribution

## Cambridge reconstruction scenario

The demo contains 70 independent GPS sessions from the same Cambridge, United
Kingdom bounding box (`0.111-0.126 E`, `52.200-52.209 N`). They were selected
from 141 linked traces returned by the official OpenStreetMap GPS trackpoints
API. Obvious bus, car, train, non-GPS line datasets, duplicate uploads, and
traces with negligible local geometry were excluded.

Every selected source page was publicly listed as `Identifiable` when checked
on 2026-09-05. The canonical list of trace IDs, contributors, display names,
and activity labels lives in
[`scripts/cambridge-traces.mjs`](../scripts/cambridge-traces.mjs). Every session
inside [`fixtures/osm-cambridge-sessions.json`](../fixtures/osm-cambridge-sessions.json)
also retains its direct OpenStreetMap source URL.

| Measure                         |   Value |
| ------------------------------- | ------: |
| Selected sessions               |      70 |
| Walking sessions                |      14 |
| Running sessions                |       5 |
| Riding sessions                 |      16 |
| General mapping/survey sessions |      35 |
| Original source points          | 567,637 |
| Points inside the shared area   |  34,024 |
| Retained replay points          |  14,510 |

The importer retains ordered track points only. It excludes unrelated waypoints,
crops each source to the shared test area, preserves segment breaks when a trace
leaves and re-enters the area, replaces original timestamps with synthetic
one-second intervals, and samples each session to at most 300 points. Gzip and
bzip2 source archives are decoded before structured GPX parsing. Run
`npm run fixtures:refresh` to reproduce the checked-in scenario.

Attribution: (c) OpenStreetMap contributors. The fixture data is provided under
the [Open Data Commons Open Database License 1.0](https://opendatacommons.org/licenses/odbl/1-0/).
See the [OpenStreetMap copyright notice](https://www.openstreetmap.org/copyright).

The fixture is data, not application source code. The repository's MIT license
applies to source code and original project assets; it does not replace the
fixture's ODbL terms. No OpenStreetMap basemap or map tiles are distributed or
requested by the application.
