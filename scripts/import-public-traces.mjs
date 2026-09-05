import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { XMLParser } from "fast-xml-parser";

const traces = [
  {
    activity: "WALK",
    file: "osm-rochdale-canal-walk.json",
    id: 11982156,
    name: "Rochdale Canal, Mills Hill",
    sourceName: "TS1892a.GPX",
    user: "SomeoneElse",
  },
  {
    activity: "WALK",
    file: "osm-arctic-walking-loop.json",
    id: 12425703,
    name: "Arctic Walking Loop",
    sourceName: "2026_07_10_10_54_13.GPX",
    user: "SaPeKa",
  },
  {
    activity: "HIKE",
    file: "osm-forest-hiking-traverse.json",
    id: 12437049,
    name: "Forest Hiking Traverse",
    sourceName: "2026_07_20_3127025778_Wandern.gpx",
    user: "propivo",
  },
  {
    activity: "RUN",
    file: "osm-branched-morning-run.json",
    id: 12328611,
    name: "Branched Morning Run",
    sourceName: "Morning_Run.gpx",
    user: "Naya Kabir",
  },
  {
    activity: "RUN",
    file: "osm-urban-running-loop.json",
    id: 12440920,
    name: "Urban Running Loop",
    sourceName: "2026_07_31_3156983479_Laufen.gpx",
    user: "propivo",
  },
  {
    activity: "RIDE",
    file: "osm-mountain-bike-loop.json",
    id: 12018098,
    name: "Mountain Bike Loop",
    sourceName: "Morning_Mountain_Bike_Ride.gpx",
    user: "Extills",
  },
];

const parser = new XMLParser({
  attributeNamePrefix: "",
  ignoreAttributes: false,
  parseAttributeValue: true,
  trimValues: true,
});

function array(value) {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function sampleEvenly(points, limit = 240) {
  if (points.length <= limit) return points;
  const sampled = [];
  for (let index = 0; index < limit; index += 1) {
    sampled.push(
      points[Math.round((index * (points.length - 1)) / (limit - 1))],
    );
  }
  return sampled;
}

function extractPoints(xml) {
  const document = parser.parse(xml);
  const tracks = array(document.gpx?.trk);
  return tracks.flatMap((track) =>
    array(track.trkseg).flatMap((segment) =>
      array(segment.trkpt).map((point) => ({
        elevation: Number.isFinite(Number(point.ele))
          ? Number(point.ele)
          : undefined,
        latitude: Number(point.lat),
        longitude: Number(point.lon),
      })),
    ),
  );
}

async function download(url, label) {
  let lastError;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { "user-agent": "Mappie fixture importer" },
        signal: AbortSignal.timeout(30_000),
      });
      if (response.ok) return response.text();
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolveDelay) =>
      setTimeout(resolveDelay, attempt * 500),
    );
  }
  throw new Error(`${label} could not be downloaded`, { cause: lastError });
}

for (const trace of traces) {
  const sourceUrl = `https://www.openstreetmap.org/user/${encodeURIComponent(trace.user)}/traces/${trace.id}`;
  const sourcePage = await download(sourceUrl, `Trace ${trace.id} page`);
  if (!/Visibility:<\/th>\s*<td>\s*Public\b/i.test(sourcePage)) {
    throw new Error(`Trace ${trace.id} is no longer marked PUBLIC`);
  }
  const rawPoints = extractPoints(
    await download(
      `https://www.openstreetmap.org/traces/${trace.id}/data`,
      `Trace ${trace.id} data`,
    ),
  );
  if (rawPoints.length < 2) {
    throw new Error(`Trace ${trace.id} did not contain a usable track`);
  }

  const points = sampleEvenly(rawPoints).map((point, index) => ({
    latitude: point.latitude,
    longitude: point.longitude,
    ...(point.elevation === undefined ? {} : { elevation: point.elevation }),
    time: new Date(Date.UTC(2026, 0, 1) + index * 1_000).toISOString(),
  }));
  const fixture = {
    activity: trace.activity,
    license: "ODbL 1.0; (c) OpenStreetMap contributors",
    name: trace.name,
    originalPointCount: rawPoints.length,
    source: `OpenStreetMap public GPS trace ${trace.sourceName}`,
    sourceUrl,
    traceId: trace.id,
    visibility: "PUBLIC",
    points,
  };

  await writeFile(
    resolve("fixtures", trace.file),
    `${JSON.stringify(fixture, null, 2)}\n`,
    "utf8",
  );
  console.log(
    `Imported trace ${trace.id}: ${rawPoints.length} -> ${points.length} points`,
  );
}
