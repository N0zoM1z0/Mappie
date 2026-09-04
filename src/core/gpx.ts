import { XMLParser, XMLValidator } from "fast-xml-parser";

import type { Track, TrackPoint } from "./types";

interface XMLNode {
  [key: string]: unknown;
}

interface PointNode {
  node: XMLNode;
  segmentStart: boolean;
}

const MAX_GPX_CHARACTERS = 20_000_000;
const MAX_GPX_POINTS = 100_000;

const parser = new XMLParser({
  attributeNamePrefix: "@_",
  ignoreAttributes: false,
  removeNSPrefix: true,
  trimValues: true,
});

function asArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function stringValue(value: unknown): string | undefined {
  if (typeof value === "string" || typeof value === "number")
    return String(value);
  return undefined;
}

function pointFromNode(
  node: XMLNode,
  fallbackTimestamp: number,
  segmentStart: boolean,
): TrackPoint | null {
  const latitude = Number(node["@_lat"]);
  const longitude = Number(node["@_lon"]);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  const rawTime = stringValue(node.time);
  const parsedTime = rawTime ? Date.parse(rawTime) : Number.NaN;
  const elevation = Number(node.ele);
  return {
    latitude,
    longitude,
    timestamp: Number.isFinite(parsedTime) ? parsedTime : fallbackTimestamp,
    ...(Number.isFinite(elevation) ? { elevation } : {}),
    ...(segmentStart ? { segmentStart: true } : {}),
  };
}

function trackNodes(root: XMLNode): PointNode[] {
  const tracks = asArray(root.trk as XMLNode | XMLNode[] | undefined);
  return tracks.flatMap((track, trackIndex) => {
    const segments = asArray(track.trkseg as XMLNode | XMLNode[] | undefined);
    return segments.flatMap((segment, segmentIndex) =>
      asArray(segment.trkpt as XMLNode | XMLNode[] | undefined).map(
        (node, pointIndex) => ({
          node,
          segmentStart:
            pointIndex === 0 && (segmentIndex > 0 || trackIndex > 0),
        }),
      ),
    );
  });
}

export function parseGPX(xml: string, sourceName = "Imported route"): Track {
  if (xml.length > MAX_GPX_CHARACTERS)
    throw new Error("This GPX file is larger than the 20 MB import limit.");
  const normalizedXML = xml.trimStart();
  const validation = XMLValidator.validate(normalizedXML);
  if (validation !== true)
    throw new Error(`Unable to parse GPX: ${validation.err.msg}`);

  let document: XMLNode;
  try {
    document = parser.parse(normalizedXML) as XMLNode;
  } catch (error) {
    throw new Error(
      `Unable to parse GPX: ${error instanceof Error ? error.message : "invalid XML"}`,
    );
  }

  const root = document.gpx as XMLNode | undefined;
  if (!root) throw new Error("This file does not contain a GPX document.");

  const nodes = trackNodes(root);
  const routeNodes = asArray(
    root.rte as XMLNode | XMLNode[] | undefined,
  ).flatMap((route, routeIndex) =>
    asArray(route.rtept as XMLNode | XMLNode[] | undefined).map(
      (node, pointIndex) => ({
        node,
        segmentStart: pointIndex === 0 && routeIndex > 0,
      }),
    ),
  );
  const selectedNodes = nodes.length > 0 ? nodes : routeNodes;
  if (selectedNodes.length === 0)
    throw new Error("This GPX file has no track or route points.");
  if (selectedNodes.length > MAX_GPX_POINTS) {
    throw new Error(
      `This GPX file exceeds the ${MAX_GPX_POINTS.toLocaleString()} point import limit.`,
    );
  }

  const baseTimestamp = Date.now();
  const points = selectedNodes
    .map(({ node, segmentStart }, index) =>
      pointFromNode(node, baseTimestamp + index * 1_000, segmentStart),
    )
    .filter((point): point is TrackPoint => point !== null);
  if (points.length === 0)
    throw new Error("This GPX file has no valid coordinates.");

  const firstTrack = asArray(root.trk as XMLNode | XMLNode[] | undefined)[0];
  const metadata = root.metadata as XMLNode | undefined;
  const parsedName =
    stringValue(firstTrack?.name) ?? stringValue(metadata?.name) ?? sourceName;

  return {
    id: `gpx-${baseTimestamp}-${Math.random().toString(36).slice(2, 8)}`,
    name: parsedName,
    source: "gpx",
    createdAt: points[0]?.timestamp ?? baseTimestamp,
    points,
  };
}
