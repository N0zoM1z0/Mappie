import type { FilterReport, TrackPoint } from "./types";

const EARTH_RADIUS_METERS = 6_371_008.8;
const DEG_TO_RAD = Math.PI / 180;

export const DEFAULT_FILTER = {
  maxAccuracyMeters: 50,
  maxSpeedMetersPerSecond: 12,
  minDistanceMeters: 2,
} as const;

export function haversineDistance(a: TrackPoint, b: TrackPoint): number {
  const lat1 = a.latitude * DEG_TO_RAD;
  const lat2 = b.latitude * DEG_TO_RAD;
  const deltaLat = (b.latitude - a.latitude) * DEG_TO_RAD;
  const deltaLon = (b.longitude - a.longitude) * DEG_TO_RAD;
  const sinLat = Math.sin(deltaLat / 2);
  const sinLon = Math.sin(deltaLon / 2);
  const h = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLon * sinLon;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function trackDistance(points: TrackPoint[]): number {
  let distance = 0;
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    if (
      previous &&
      current &&
      !current.segmentStart &&
      current.timestamp - previous.timestamp <= 180_000
    ) {
      distance += haversineDistance(previous, current);
    }
  }
  return distance;
}

function isValidPoint(point: TrackPoint): boolean {
  return (
    Number.isFinite(point.latitude) &&
    Number.isFinite(point.longitude) &&
    Number.isFinite(point.timestamp) &&
    point.latitude >= -90 &&
    point.latitude <= 90 &&
    point.longitude >= -180 &&
    point.longitude <= 180
  );
}

export function filterTrackPoints(
  points: TrackPoint[],
  options: Partial<typeof DEFAULT_FILTER> = {},
): FilterReport {
  const config = { ...DEFAULT_FILTER, ...options };
  const accepted: TrackPoint[] = [];
  const rejected = {
    inaccurate: 0,
    invalid: 0,
    tooClose: 0,
    tooFast: 0,
    nonMonotonic: 0,
  };

  for (const point of points) {
    if (!isValidPoint(point)) {
      rejected.invalid += 1;
      continue;
    }
    if (
      point.accuracy !== undefined &&
      point.accuracy > config.maxAccuracyMeters
    ) {
      rejected.inaccurate += 1;
      continue;
    }

    const previous = accepted.at(-1);
    if (!previous || point.segmentStart) {
      accepted.push(point);
      continue;
    }

    const elapsedSeconds = (point.timestamp - previous.timestamp) / 1_000;
    if (elapsedSeconds <= 0) {
      rejected.nonMonotonic += 1;
      continue;
    }

    const distance = haversineDistance(previous, point);
    if (distance < config.minDistanceMeters) {
      rejected.tooClose += 1;
      continue;
    }
    if (distance / elapsedSeconds > config.maxSpeedMetersPerSecond) {
      rejected.tooFast += 1;
      continue;
    }
    accepted.push(point);
  }

  return { accepted, rejected };
}

export function splitTrackAtGaps(
  points: TrackPoint[],
  maxGapSeconds = 180,
): TrackPoint[][] {
  if (points.length === 0) return [];
  const segments: TrackPoint[][] = [[points[0]!]];

  for (let index = 1; index < points.length; index += 1) {
    const point = points[index]!;
    const previous = points[index - 1]!;
    const elapsed = (point.timestamp - previous.timestamp) / 1_000;
    if (point.segmentStart || elapsed > maxGapSeconds) segments.push([]);
    segments.at(-1)!.push(point);
  }

  return segments;
}

export function totalRejected(report: FilterReport): number {
  return Object.values(report.rejected).reduce((sum, count) => sum + count, 0);
}
