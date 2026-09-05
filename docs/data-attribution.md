# Data attribution

## OpenStreetMap GPS fixtures

The replay gallery contains six traces downloaded from OpenStreetMap pages that
were explicitly marked `PUBLIC` when checked on 2026-09-05.

| Fixture                           | Activity |                                                                   OSM trace | Source points | Retained points |
| --------------------------------- | -------- | --------------------------------------------------------------------------: | ------------: | --------------: |
| `osm-rochdale-canal-walk.json`    | Walk     |  [11982156](https://www.openstreetmap.org/user/SomeoneElse/traces/11982156) |            33 |              33 |
| `osm-arctic-walking-loop.json`    | Walk     |       [12425703](https://www.openstreetmap.org/user/SaPeKa/traces/12425703) |         3,867 |             240 |
| `osm-forest-hiking-traverse.json` | Hike     |      [12437049](https://www.openstreetmap.org/user/propivo/traces/12437049) |         6,221 |             240 |
| `osm-branched-morning-run.json`   | Run      | [12328611](https://www.openstreetmap.org/user/Naya%20Kabir/traces/12328611) |        10,740 |             240 |
| `osm-urban-running-loop.json`     | Run      |      [12440920](https://www.openstreetmap.org/user/propivo/traces/12440920) |         4,318 |             240 |
| `osm-mountain-bike-loop.json`     | Ride     |      [12018098](https://www.openstreetmap.org/user/Extills/traces/12018098) |         2,188 |             240 |

The importer retains ordered track points only. It excludes unrelated waypoints
and annotations, replaces source timestamps with fixed synthetic one-second
intervals, and evenly samples long traces to keep mobile replay bounded. Run
`npm run fixtures:refresh` to reproduce the checked-in JSON from the source GPX
files.

Attribution: (c) OpenStreetMap contributors. The fixture data is provided under
the [Open Data Commons Open Database License 1.0](https://opendatacommons.org/licenses/odbl/1-0/).
See the [OpenStreetMap copyright notice](https://www.openstreetmap.org/copyright).

The optional discovery names and descriptions in `src/data/demoTrack.ts` are
fictional interaction samples. They do not identify real people or claim that a
real point of interest exists at the marker coordinate.

The fixtures are data, not application source code. The repository's MIT
license applies to source code and original project assets; it does not replace
the fixtures' ODbL terms. No OpenStreetMap basemap or map tiles are distributed
or requested by the application.
