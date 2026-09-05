import { splitTrackAtGaps } from "./geo";
import type { Track, TrackPoint } from "./types";

const METERS_PER_DEGREE_LATITUDE = 111_320;

export interface ReconstructionOptions {
  resampleMeters: number;
  simplifyMeters: number;
  snapMeters: number;
}

export interface ReconstructedNode {
  id: number;
  latitude: number;
  longitude: number;
  observationCount: number;
}

export interface ReconstructedEdge {
  distanceMeters: number;
  firstSeenSession: number;
  from: number;
  id: string;
  lastSeenSession: number;
  sessionIds: string[];
  to: number;
  visitCount: number;
}

export interface SessionContribution {
  addedEdges: number;
  newDistanceMeters: number;
  revisitedDistanceMeters: number;
  sessionId: string;
}

export interface ReconstructionResult {
  confidence: number;
  edges: ReconstructedEdge[];
  intersectionCount: number;
  knownDistanceMeters: number;
  nodes: ReconstructedNode[];
  sessions: SessionContribution[];
}

interface MetricPoint {
  source: TrackPoint;
  x: number;
  y: number;
}

interface WorkingNode {
  anchorBucket: string;
  id: number;
  observationCount: number;
  x: number;
  y: number;
}

export const DEFAULT_RECONSTRUCTION_OPTIONS: ReconstructionOptions = {
  resampleMeters: 9,
  simplifyMeters: 3,
  snapMeters: 12,
};

function pointSegmentDistance(
  point: MetricPoint,
  start: MetricPoint,
  end: MetricPoint,
): number {
  const deltaX = end.x - start.x;
  const deltaY = end.y - start.y;
  const lengthSquared = deltaX * deltaX + deltaY * deltaY;
  if (lengthSquared === 0)
    return Math.hypot(point.x - start.x, point.y - start.y);
  const position = Math.max(
    0,
    Math.min(
      1,
      ((point.x - start.x) * deltaX + (point.y - start.y) * deltaY) /
        lengthSquared,
    ),
  );
  return Math.hypot(
    point.x - (start.x + position * deltaX),
    point.y - (start.y + position * deltaY),
  );
}

function simplify(points: MetricPoint[], tolerance: number): MetricPoint[] {
  if (points.length <= 2) return points;
  let furthestIndex = 0;
  let furthestDistance = 0;
  const first = points[0]!;
  const last = points.at(-1)!;
  for (let index = 1; index < points.length - 1; index += 1) {
    const distance = pointSegmentDistance(points[index]!, first, last);
    if (distance > furthestDistance) {
      furthestDistance = distance;
      furthestIndex = index;
    }
  }
  if (furthestDistance <= tolerance) return [first, last];
  const before = simplify(points.slice(0, furthestIndex + 1), tolerance);
  const after = simplify(points.slice(furthestIndex), tolerance);
  return [...before.slice(0, -1), ...after];
}

function resample(points: MetricPoint[], interval: number): MetricPoint[] {
  if (points.length <= 1) return points;
  const output: MetricPoint[] = [points[0]!];
  for (let index = 1; index < points.length; index += 1) {
    const start = points[index - 1]!;
    const end = points[index]!;
    const distance = Math.hypot(end.x - start.x, end.y - start.y);
    const steps = Math.max(1, Math.ceil(distance / interval));
    for (let step = 1; step <= steps; step += 1) {
      const ratio = step / steps;
      output.push({
        source: step === steps ? end.source : start.source,
        x: start.x + (end.x - start.x) * ratio,
        y: start.y + (end.y - start.y) * ratio,
      });
    }
  }
  return output;
}

export function reconstructMap(
  tracks: Track[],
  options: Partial<ReconstructionOptions> = {},
): ReconstructionResult {
  const config = { ...DEFAULT_RECONSTRUCTION_OPTIONS, ...options };
  const allPoints = tracks.flatMap((track) => track.points);
  if (allPoints.length === 0) {
    return {
      confidence: 0,
      edges: [],
      intersectionCount: 0,
      knownDistanceMeters: 0,
      nodes: [],
      sessions: [],
    };
  }

  const latitudeCenter =
    allPoints.reduce((sum, point) => sum + point.latitude, 0) /
    allPoints.length;
  const longitudeScale =
    METERS_PER_DEGREE_LATITUDE * Math.cos((latitudeCenter * Math.PI) / 180);
  const toMetric = (point: TrackPoint): MetricPoint => ({
    source: point,
    x: point.longitude * longitudeScale,
    y: point.latitude * METERS_PER_DEGREE_LATITUDE,
  });
  const toBucket = (x: number, y: number) =>
    `${Math.floor(x / config.snapMeters)},${Math.floor(y / config.snapMeters)}`;

  const nodes: WorkingNode[] = [];
  const buckets = new Map<string, Set<number>>();
  const edges = new Map<string, ReconstructedEdge>();
  const sessions: SessionContribution[] = [];

  const putInBucket = (node: WorkingNode) => {
    const key = toBucket(node.x, node.y);
    if (node.anchorBucket !== key) {
      buckets.get(node.anchorBucket)?.delete(node.id);
      node.anchorBucket = key;
    }
    const bucket = buckets.get(key) ?? new Set<number>();
    bucket.add(node.id);
    buckets.set(key, bucket);
  };

  const snapNode = (point: MetricPoint) => {
    const cellX = Math.floor(point.x / config.snapMeters);
    const cellY = Math.floor(point.y / config.snapMeters);
    let closest: WorkingNode | undefined;
    let closestDistance = config.snapMeters;
    for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
      for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
        const ids = buckets.get(`${cellX + offsetX},${cellY + offsetY}`);
        if (!ids) continue;
        for (const id of ids) {
          const candidate = nodes[id]!;
          const distance = Math.hypot(
            candidate.x - point.x,
            candidate.y - point.y,
          );
          if (distance <= closestDistance) {
            closest = candidate;
            closestDistance = distance;
          }
        }
      }
    }
    if (!closest) {
      const created: WorkingNode = {
        anchorBucket: "",
        id: nodes.length,
        observationCount: 1,
        x: point.x,
        y: point.y,
      };
      nodes.push(created);
      putInBucket(created);
      return created.id;
    }

    const nextCount = closest.observationCount + 1;
    closest.x = (closest.x * closest.observationCount + point.x) / nextCount;
    closest.y = (closest.y * closest.observationCount + point.y) / nextCount;
    closest.observationCount = nextCount;
    putInBucket(closest);
    return closest.id;
  };

  tracks.forEach((track, sessionIndex) => {
    let newDistanceMeters = 0;
    let revisitedDistanceMeters = 0;
    let addedEdges = 0;
    const visitedThisSession = new Set<string>();

    for (const segment of splitTrackAtGaps(track.points)) {
      const observations = resample(
        simplify(segment.map(toMetric), config.simplifyMeters),
        config.resampleMeters,
      );
      let previousNode: number | undefined;
      for (const observation of observations) {
        const nodeId = snapNode(observation);
        if (previousNode === undefined || previousNode === nodeId) {
          previousNode = nodeId;
          continue;
        }

        const from = Math.min(previousNode, nodeId);
        const to = Math.max(previousNode, nodeId);
        const id = `${from}:${to}`;
        const distanceMeters = Math.hypot(
          nodes[from]!.x - nodes[to]!.x,
          nodes[from]!.y - nodes[to]!.y,
        );
        let edge = edges.get(id);
        if (!edge) {
          edge = {
            distanceMeters,
            firstSeenSession: sessionIndex,
            from,
            id,
            lastSeenSession: sessionIndex,
            sessionIds: [track.id],
            to,
            visitCount: 1,
          };
          edges.set(id, edge);
          newDistanceMeters += distanceMeters;
          addedEdges += 1;
        } else if (!visitedThisSession.has(id)) {
          edge.lastSeenSession = sessionIndex;
          edge.sessionIds.push(track.id);
          edge.visitCount += 1;
          revisitedDistanceMeters += edge.distanceMeters;
        }
        visitedThisSession.add(id);
        previousNode = nodeId;
      }
    }

    sessions.push({
      addedEdges,
      newDistanceMeters,
      revisitedDistanceMeters,
      sessionId: track.id,
    });
  });

  const outputNodes = nodes.map((node) => ({
    id: node.id,
    latitude: node.y / METERS_PER_DEGREE_LATITUDE,
    longitude: node.x / longitudeScale,
    observationCount: node.observationCount,
  }));
  const outputEdges = [...edges.values()].map((edge) => ({
    ...edge,
    distanceMeters: Math.hypot(
      nodes[edge.from]!.x - nodes[edge.to]!.x,
      nodes[edge.from]!.y - nodes[edge.to]!.y,
    ),
  }));
  const knownDistanceMeters = outputEdges.reduce(
    (sum, edge) => sum + edge.distanceMeters,
    0,
  );
  const confidenceDistance = outputEdges.reduce(
    (sum, edge) => sum + edge.distanceMeters * Math.min(1, edge.visitCount / 3),
    0,
  );
  const degree = new Map<number, number>();
  for (const edge of outputEdges) {
    degree.set(edge.from, (degree.get(edge.from) ?? 0) + 1);
    degree.set(edge.to, (degree.get(edge.to) ?? 0) + 1);
  }

  return {
    confidence:
      knownDistanceMeters === 0 ? 0 : confidenceDistance / knownDistanceMeters,
    edges: outputEdges,
    intersectionCount: [...degree.values()].filter((value) => value >= 3)
      .length,
    knownDistanceMeters,
    nodes: outputNodes,
    sessions,
  };
}

export function reconstructionTracks(
  result: ReconstructionResult,
  visibleSessionCount: number,
): Track[] {
  const timestamp = Date.UTC(2026, 0, 1);
  return result.edges
    .filter((edge) => edge.firstSeenSession < visibleSessionCount)
    .map((edge) => ({
      createdAt: timestamp,
      id: `edge-${edge.id}`,
      name: `Observed edge ${edge.id}`,
      points: [
        { ...result.nodes[edge.from]!, timestamp },
        { ...result.nodes[edge.to]!, timestamp: timestamp + 1_000 },
      ],
      source: "demo",
    }));
}
