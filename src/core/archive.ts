import type { ExplorationArchive, Track, TrackPoint } from "./types";

export const MAPPIE_ARCHIVE_FORMAT = "mappie-exploration-archive";
export const MAPPIE_ARCHIVE_VERSION = 1;
export const MAX_ARCHIVE_FILE_BYTES = 50 * 1024 * 1024;

export interface MappieArchiveFile {
  exportedAt: string;
  format: typeof MAPPIE_ARCHIVE_FORMAT;
  tracks: Track[];
  version: typeof MAPPIE_ARCHIVE_VERSION;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function isTrackPoint(value: unknown): value is TrackPoint {
  if (!value || typeof value !== "object") return false;
  const point = value as Partial<TrackPoint>;
  return (
    isFiniteNumber(point.latitude) &&
    isFiniteNumber(point.longitude) &&
    isFiniteNumber(point.timestamp) &&
    (point.accuracy === undefined || isFiniteNumber(point.accuracy)) &&
    (point.elevation === undefined || isFiniteNumber(point.elevation)) &&
    (point.segmentStart === undefined ||
      typeof point.segmentStart === "boolean")
  );
}

export function isTrack(value: unknown): value is Track {
  if (!value || typeof value !== "object") return false;
  const track = value as Partial<Track>;
  return (
    typeof track.id === "string" &&
    track.id.length > 0 &&
    typeof track.name === "string" &&
    isFiniteNumber(track.createdAt) &&
    (track.source === "demo" ||
      track.source === "gpx" ||
      track.source === "live") &&
    Array.isArray(track.points) &&
    track.points.every(isTrackPoint)
  );
}

function parseJson(text: string, errorMessage: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error(errorMessage);
  }
}

export function parseStoredArchive(raw: string): Track[] {
  try {
    const archive = parseJson(raw, "") as Partial<ExplorationArchive>;
    if (
      archive.version !== MAPPIE_ARCHIVE_VERSION ||
      !Array.isArray(archive.tracks) ||
      !archive.tracks.every(isTrack)
    ) {
      return [];
    }
    return archive.tracks;
  } catch {
    return [];
  }
}

export function serializeMappieArchive(
  tracks: Track[],
  exportedAt = new Date(),
): string {
  const archive: MappieArchiveFile = {
    exportedAt: exportedAt.toISOString(),
    format: MAPPIE_ARCHIVE_FORMAT,
    tracks,
    version: MAPPIE_ARCHIVE_VERSION,
  };
  return `${JSON.stringify(archive, null, 2)}\n`;
}

export function parseMappieArchive(text: string): MappieArchiveFile {
  if (new TextEncoder().encode(text).byteLength > MAX_ARCHIVE_FILE_BYTES) {
    throw new Error("This archive is larger than Mappie's 50 MB import limit.");
  }

  const value = parseJson(text, "This file is not valid JSON.");
  if (!value || typeof value !== "object") {
    throw new Error("This file is not a Mappie archive.");
  }

  const archive = value as Partial<MappieArchiveFile>;
  if (archive.format !== MAPPIE_ARCHIVE_FORMAT) {
    throw new Error("This file is not a Mappie archive.");
  }
  if (archive.version !== MAPPIE_ARCHIVE_VERSION) {
    throw new Error(
      `Mappie archive version ${String(archive.version)} is not supported.`,
    );
  }
  if (
    typeof archive.exportedAt !== "string" ||
    !Number.isFinite(Date.parse(archive.exportedAt))
  ) {
    throw new Error("The archive has an invalid export date.");
  }
  if (!Array.isArray(archive.tracks) || !archive.tracks.every(isTrack)) {
    throw new Error("The archive contains an invalid exploration track.");
  }

  const ids = new Set(archive.tracks.map((track) => track.id));
  if (ids.size !== archive.tracks.length) {
    throw new Error("The archive contains duplicate exploration IDs.");
  }

  return archive as MappieArchiveFile;
}
