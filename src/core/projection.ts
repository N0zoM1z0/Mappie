import type { ProjectionResult, Track } from "./types";

const METERS_PER_DEGREE_LATITUDE = 111_320;

export interface TrackViewport {
  centerLatitude: number;
  centerLongitude: number;
  longitudeScale: number;
  minX: number;
  minY: number;
  offsetX: number;
  offsetY: number;
  pixelsPerMeter: number;
}

export function fitTrackViewport(
  fitTracks: Track[],
  width: number,
  height: number,
  padding = 42,
): TrackViewport | null {
  const fitPoints = fitTracks.flatMap((track) => track.points);
  if (fitPoints.length === 0 || width <= 0 || height <= 0) return null;

  const latitudeCenter =
    fitPoints.reduce((sum, point) => sum + point.latitude, 0) /
    fitPoints.length;
  const longitudeScale =
    METERS_PER_DEGREE_LATITUDE * Math.cos((latitudeCenter * Math.PI) / 180);
  const bounds = fitPoints.reduce(
    (current, point) => ({
      minX: Math.min(current.minX, point.longitude * longitudeScale),
      maxX: Math.max(current.maxX, point.longitude * longitudeScale),
      minY: Math.min(
        current.minY,
        -point.latitude * METERS_PER_DEGREE_LATITUDE,
      ),
      maxY: Math.max(
        current.maxY,
        -point.latitude * METERS_PER_DEGREE_LATITUDE,
      ),
      minLatitude: Math.min(current.minLatitude, point.latitude),
      maxLatitude: Math.max(current.maxLatitude, point.latitude),
      minLongitude: Math.min(current.minLongitude, point.longitude),
      maxLongitude: Math.max(current.maxLongitude, point.longitude),
    }),
    {
      minX: Number.POSITIVE_INFINITY,
      maxX: Number.NEGATIVE_INFINITY,
      minY: Number.POSITIVE_INFINITY,
      maxY: Number.NEGATIVE_INFINITY,
      minLatitude: Number.POSITIVE_INFINITY,
      maxLatitude: Number.NEGATIVE_INFINITY,
      minLongitude: Number.POSITIVE_INFINITY,
      maxLongitude: Number.NEGATIVE_INFINITY,
    },
  );
  const spanX = Math.max(bounds.maxX - bounds.minX, 20);
  const spanY = Math.max(bounds.maxY - bounds.minY, 20);
  const pixelsPerMeter = Math.min(
    Math.max(width - padding * 2, 1) / spanX,
    Math.max(height - padding * 2, 1) / spanY,
  );

  return {
    centerLatitude: (bounds.minLatitude + bounds.maxLatitude) / 2,
    centerLongitude: (bounds.minLongitude + bounds.maxLongitude) / 2,
    longitudeScale,
    minX: bounds.minX,
    minY: bounds.minY,
    offsetX: (width - spanX * pixelsPerMeter) / 2,
    offsetY: (height - spanY * pixelsPerMeter) / 2,
    pixelsPerMeter,
  };
}

export function projectTracksToViewport(
  tracks: Track[],
  viewport: TrackViewport | null,
): ProjectionResult {
  const allPoints = tracks.flatMap((track) => track.points);
  if (allPoints.length === 0 || !viewport) {
    return { tracks: [], center: null, metersPerPixel: 1 };
  }

  return {
    tracks: tracks.map((track) => ({
      id: track.id,
      points: track.points.map((point) => ({
        x:
          viewport.offsetX +
          (point.longitude * viewport.longitudeScale - viewport.minX) *
            viewport.pixelsPerMeter,
        y:
          viewport.offsetY +
          (-point.latitude * METERS_PER_DEGREE_LATITUDE - viewport.minY) *
            viewport.pixelsPerMeter,
        source: point,
      })),
    })),
    center: {
      latitude: viewport.centerLatitude,
      longitude: viewport.centerLongitude,
      timestamp: allPoints.at(-1)?.timestamp ?? Date.now(),
    },
    metersPerPixel: 1 / viewport.pixelsPerMeter,
  };
}

export function projectTracks(
  tracks: Track[],
  width: number,
  height: number,
  padding = 42,
  fitTracks = tracks,
): ProjectionResult {
  return projectTracksToViewport(
    tracks,
    fitTrackViewport(fitTracks, width, height, padding),
  );
}

export function pointsToPath(points: Array<{ x: number; y: number }>): string {
  return points
    .map(
      (point, index) =>
        `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`,
    )
    .join(" ");
}
