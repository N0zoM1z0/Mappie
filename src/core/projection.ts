import type { ProjectionResult, Track, TrackPoint } from "./types";

const METERS_PER_DEGREE_LATITUDE = 111_320;

interface MetricPoint {
  x: number;
  y: number;
  source: TrackPoint;
}

export function projectTracks(
  tracks: Track[],
  width: number,
  height: number,
  padding = 42,
  fitTracks = tracks,
): ProjectionResult {
  const allPoints = tracks.flatMap((track) => track.points);
  const fitPoints = fitTracks.flatMap((track) => track.points);
  if (
    allPoints.length === 0 ||
    fitPoints.length === 0 ||
    width <= 0 ||
    height <= 0
  ) {
    return { tracks: [], center: null, metersPerPixel: 1 };
  }

  const latitudeCenter =
    fitPoints.reduce((sum, point) => sum + point.latitude, 0) /
    fitPoints.length;
  const longitudeScale =
    METERS_PER_DEGREE_LATITUDE * Math.cos((latitudeCenter * Math.PI) / 180);
  const latitudeScale = METERS_PER_DEGREE_LATITUDE;
  const metricTracks = tracks.map((track) => ({
    id: track.id,
    points: track.points.map((point) => ({
      x: point.longitude * longitudeScale,
      y: -point.latitude * latitudeScale,
      source: point,
    })),
  }));
  const fitMetrics = fitPoints.map((point) => ({
    x: point.longitude * longitudeScale,
    y: -point.latitude * latitudeScale,
  }));
  const bounds = fitMetrics.reduce(
    (current, point) => ({
      minX: Math.min(current.minX, point.x),
      maxX: Math.max(current.maxX, point.x),
      minY: Math.min(current.minY, point.y),
      maxY: Math.max(current.maxY, point.y),
    }),
    {
      minX: Number.POSITIVE_INFINITY,
      maxX: Number.NEGATIVE_INFINITY,
      minY: Number.POSITIVE_INFINITY,
      maxY: Number.NEGATIVE_INFINITY,
    },
  );
  const { minX, maxX, minY, maxY } = bounds;
  const coordinateBounds = fitPoints.reduce(
    (current, point) => ({
      minLatitude: Math.min(current.minLatitude, point.latitude),
      maxLatitude: Math.max(current.maxLatitude, point.latitude),
      minLongitude: Math.min(current.minLongitude, point.longitude),
      maxLongitude: Math.max(current.maxLongitude, point.longitude),
    }),
    {
      minLatitude: Number.POSITIVE_INFINITY,
      maxLatitude: Number.NEGATIVE_INFINITY,
      minLongitude: Number.POSITIVE_INFINITY,
      maxLongitude: Number.NEGATIVE_INFINITY,
    },
  );
  const spanX = Math.max(maxX - minX, 20);
  const spanY = Math.max(maxY - minY, 20);
  const usableWidth = Math.max(width - padding * 2, 1);
  const usableHeight = Math.max(height - padding * 2, 1);
  const pixelsPerMeter = Math.min(usableWidth / spanX, usableHeight / spanY);
  const drawWidth = spanX * pixelsPerMeter;
  const drawHeight = spanY * pixelsPerMeter;
  const offsetX = (width - drawWidth) / 2;
  const offsetY = (height - drawHeight) / 2;

  return {
    tracks: metricTracks.map((track) => ({
      id: track.id,
      points: track.points.map((point) => ({
        x: offsetX + (point.x - minX) * pixelsPerMeter,
        y: offsetY + (point.y - minY) * pixelsPerMeter,
        source: point.source,
      })),
    })),
    center: {
      latitude:
        (coordinateBounds.minLatitude + coordinateBounds.maxLatitude) / 2,
      longitude:
        (coordinateBounds.minLongitude + coordinateBounds.maxLongitude) / 2,
      timestamp: allPoints.at(-1)?.timestamp ?? Date.now(),
    },
    metersPerPixel: 1 / pixelsPerMeter,
  };
}

export function pointsToPath(points: Array<{ x: number; y: number }>): string {
  return points
    .map(
      (point, index) =>
        `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`,
    )
    .join(" ");
}
