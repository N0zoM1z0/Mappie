export type TrackSource = "demo" | "gpx" | "live";

export interface TrackPoint {
  latitude: number;
  longitude: number;
  timestamp: number;
  accuracy?: number;
  elevation?: number;
  segmentStart?: boolean;
}

export interface Track {
  id: string;
  name: string;
  source: TrackSource;
  createdAt: number;
  points: TrackPoint[];
}

export interface ExplorationArchive {
  version: 1;
  tracks: Track[];
}

export interface FilterReport {
  accepted: TrackPoint[];
  rejected: {
    inaccurate: number;
    invalid: number;
    tooClose: number;
    tooFast: number;
    nonMonotonic: number;
  };
}

export interface ProjectedPoint {
  x: number;
  y: number;
  source: TrackPoint;
}

export interface ProjectedTrack {
  id: string;
  points: ProjectedPoint[];
}

export interface ProjectionResult {
  tracks: ProjectedTrack[];
  center: TrackPoint | null;
  metersPerPixel: number;
}
