import { readdir, unlink, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { gunzipSync } from "node:zlib";

import { XMLParser } from "fast-xml-parser";
import bzip from "seek-bzip";

import { cambridgeTraces } from "./cambridge-traces.mjs";

const neighborhood = {
  east: 0.126,
  north: 52.209,
  south: 52.2,
  west: 0.111,
};

const traces = cambridgeTraces;
const fixtures = [];

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

function extractSegments(xml) {
  const document = parser.parse(xml);
  return array(document.gpx?.trk).flatMap((track) =>
    array(track.trkseg).map((segment) =>
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

function isInside(point) {
  return (
    point.longitude >= neighborhood.west &&
    point.longitude <= neighborhood.east &&
    point.latitude >= neighborhood.south &&
    point.latitude <= neighborhood.north
  );
}

function cropSegments(segments) {
  const cropped = [];
  for (const segment of segments) {
    let current = [];
    for (const point of segment) {
      if (isInside(point)) {
        current.push(point);
      } else if (current.length > 0) {
        cropped.push(current);
        current = [];
      }
    }
    if (current.length > 0) cropped.push(current);
  }
  return cropped.filter((segment) => segment.length >= 2);
}

function sampleEvenly(points, limit) {
  if (points.length <= limit) return points;
  return Array.from(
    { length: limit },
    (_, index) =>
      points[Math.round((index * (points.length - 1)) / (limit - 1))],
  );
}

function sampleSegments(segments, limit = 300) {
  const total = segments.reduce((sum, segment) => sum + segment.length, 0);
  if (total <= limit) return segments;

  const allocations = segments.map((segment) =>
    Math.min(
      segment.length,
      Math.max(2, Math.floor((segment.length / total) * limit)),
    ),
  );
  while (allocations.reduce((sum, count) => sum + count, 0) > limit) {
    const index = allocations.reduce(
      (largest, count, candidate) =>
        count > allocations[largest] && count > 2 ? candidate : largest,
      0,
    );
    allocations[index] -= 1;
  }
  while (allocations.reduce((sum, count) => sum + count, 0) < limit) {
    const index = segments.findIndex(
      (segment, candidate) => allocations[candidate] < segment.length,
    );
    if (index < 0) break;
    allocations[index] += 1;
  }
  return segments.map((segment, index) =>
    sampleEvenly(segment, allocations[index]),
  );
}

async function download(url, label, binary = false) {
  let lastError;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          "user-agent": "Mappie fixture importer (github.com/N0zoM1z0/Mappie)",
        },
        signal: AbortSignal.timeout(30_000),
      });
      if (response.ok) {
        return binary
          ? Buffer.from(await response.arrayBuffer())
          : response.text();
      }
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

function decodeTrace(buffer) {
  const isGzip = buffer[0] === 0x1f && buffer[1] === 0x8b;
  const isBzip = buffer.subarray(0, 3).toString("ascii") === "BZh";
  const decoded = isGzip
    ? gunzipSync(buffer)
    : isBzip
      ? bzip.decode(buffer)
      : buffer;
  return Buffer.from(decoded).toString("utf8");
}

for (const trace of traces) {
  const sourceUrl = `https://www.openstreetmap.org/user/${encodeURIComponent(trace.user)}/traces/${trace.id}`;
  const sourcePage = await download(sourceUrl, `Trace ${trace.id} page`);
  const visibility = sourcePage.match(
    /Visibility:<\/th>\s*<td>\s*(Identifiable|Public)\b/i,
  )?.[1];
  if (!visibility) {
    throw new Error(
      `Trace ${trace.id} is not publicly listed as Identifiable or Public`,
    );
  }

  const sourceSegments = extractSegments(
    decodeTrace(
      await download(
        `https://www.openstreetmap.org/traces/${trace.id}/data`,
        `Trace ${trace.id} data`,
        true,
      ),
    ),
  );
  const sourcePointCount = sourceSegments.reduce(
    (sum, segment) => sum + segment.length,
    0,
  );
  const areaSegments = cropSegments(sourceSegments);
  const areaPointCount = areaSegments.reduce(
    (sum, segment) => sum + segment.length,
    0,
  );
  if (areaPointCount < 2) {
    throw new Error(
      `Trace ${trace.id} does not cross the Cambridge fixture area`,
    );
  }

  let timestamp = Date.UTC(2026, 0, 1);
  const points = sampleSegments(areaSegments).flatMap((segment) =>
    segment.map((point, index) => {
      const fixturePoint = {
        latitude: point.latitude,
        longitude: point.longitude,
        ...(point.elevation === undefined
          ? {}
          : { elevation: point.elevation }),
        ...(index === 0 ? { segmentStart: true } : {}),
        time: new Date(timestamp).toISOString(),
      };
      timestamp += 1_000;
      return fixturePoint;
    }),
  );
  const fixture = {
    activity: trace.activity,
    areaPointCount,
    name: trace.name,
    sequence: fixtures.length + 1,
    source: `OpenStreetMap ${visibility.toLowerCase()} GPS trace`,
    sourcePointCount,
    sourceUrl,
    traceId: trace.id,
    visibility: visibility.toUpperCase(),
    points,
  };
  fixtures.push(fixture);
  console.log(
    `Imported trace ${trace.id}: ${sourcePointCount} source -> ${areaPointCount} area -> ${points.length} retained points`,
  );
}

await writeFile(
  resolve("fixtures", "osm-cambridge-sessions.json"),
  `${JSON.stringify(
    {
      area: "Cambridge, United Kingdom / 0.111-0.126 E, 52.200-52.209 N",
      bounds: neighborhood,
      license: "ODbL 1.0; (c) OpenStreetMap contributors",
      sessions: fixtures,
    },
    null,
    2,
  )}\n`,
  "utf8",
);

for (const file of await readdir(resolve("fixtures"))) {
  if (/^osm-cambridge-session-\d+\.json$/.test(file)) {
    await unlink(resolve("fixtures", file));
  }
}
