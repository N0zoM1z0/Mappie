import AsyncStorage from "@react-native-async-storage/async-storage";

import type { ExplorationArchive, Track, TrackPoint } from "../core/types";

const ARCHIVE_KEY = "@mappie/archive/v1";
const ACTIVE_TRACK_KEY = "@mappie/active-track/v1";
const BACKGROUND_BUFFER_KEY = "@mappie/background-buffer/v1";

let backgroundWriteQueue: Promise<void> = Promise.resolve();
let archiveWriteQueue: Promise<void> = Promise.resolve();
let activeWriteQueue: Promise<void> = Promise.resolve();

function isTrackPoint(value: unknown): value is TrackPoint {
  if (!value || typeof value !== "object") return false;
  const point = value as Partial<TrackPoint>;
  return (
    typeof point.latitude === "number" &&
    Number.isFinite(point.latitude) &&
    typeof point.longitude === "number" &&
    Number.isFinite(point.longitude) &&
    typeof point.timestamp === "number" &&
    Number.isFinite(point.timestamp)
  );
}

function isTrack(value: unknown): value is Track {
  if (!value || typeof value !== "object") return false;
  const track = value as Partial<Track>;
  return (
    typeof track.id === "string" &&
    typeof track.name === "string" &&
    typeof track.createdAt === "number" &&
    (track.source === "demo" ||
      track.source === "gpx" ||
      track.source === "live") &&
    Array.isArray(track.points) &&
    track.points.every(isTrackPoint)
  );
}

export async function loadArchive(): Promise<Track[]> {
  const raw = await AsyncStorage.getItem(ARCHIVE_KEY);
  if (!raw) return [];
  try {
    const archive = JSON.parse(raw) as Partial<ExplorationArchive>;
    if (archive.version !== 1 || !Array.isArray(archive.tracks)) return [];
    return archive.tracks.filter(isTrack);
  } catch {
    return [];
  }
}

export async function saveArchive(tracks: Track[]): Promise<void> {
  const archive: ExplorationArchive = { version: 1, tracks };
  const write = archiveWriteQueue
    .catch(() => undefined)
    .then(() => AsyncStorage.setItem(ARCHIVE_KEY, JSON.stringify(archive)));
  archiveWriteQueue = write.catch(() => undefined);
  await write;
}

export async function loadActiveTrack(): Promise<Track | null> {
  const raw = await AsyncStorage.getItem(ACTIVE_TRACK_KEY);
  if (!raw) return null;
  try {
    const track: unknown = JSON.parse(raw);
    return isTrack(track) ? track : null;
  } catch {
    return null;
  }
}

export async function saveActiveTrack(track: Track): Promise<void> {
  const write = activeWriteQueue
    .catch(() => undefined)
    .then(() => AsyncStorage.setItem(ACTIVE_TRACK_KEY, JSON.stringify(track)));
  activeWriteQueue = write.catch(() => undefined);
  await write;
}

export async function clearActiveTrack(): Promise<void> {
  const removal = activeWriteQueue
    .catch(() => undefined)
    .then(() => AsyncStorage.removeItem(ACTIVE_TRACK_KEY));
  activeWriteQueue = removal.catch(() => undefined);
  await removal;
}

export function appendBackgroundPoints(points: TrackPoint[]): Promise<void> {
  const write = backgroundWriteQueue
    .catch(() => undefined)
    .then(async () => {
      const raw = await AsyncStorage.getItem(BACKGROUND_BUFFER_KEY);
      let buffered: TrackPoint[] = [];
      if (raw) {
        try {
          const parsed: unknown = JSON.parse(raw);
          if (Array.isArray(parsed)) buffered = parsed as TrackPoint[];
        } catch {
          buffered = [];
        }
      }
      await AsyncStorage.setItem(
        BACKGROUND_BUFFER_KEY,
        JSON.stringify([...buffered, ...points]),
      );
    });
  backgroundWriteQueue = write.catch(() => undefined);
  return write;
}

export function drainBackgroundPoints(): Promise<TrackPoint[]> {
  let result: TrackPoint[] = [];
  const drain = backgroundWriteQueue
    .catch(() => undefined)
    .then(async () => {
      const raw = await AsyncStorage.getItem(BACKGROUND_BUFFER_KEY);
      await AsyncStorage.removeItem(BACKGROUND_BUFFER_KEY);
      if (!raw) return;
      try {
        const parsed: unknown = JSON.parse(raw);
        if (Array.isArray(parsed)) result = parsed.filter(isTrackPoint);
      } catch {
        result = [];
      }
    });
  backgroundWriteQueue = drain.catch(() => undefined);
  return drain.then(() => result);
}

export async function clearAllExplorationData(): Promise<void> {
  await Promise.all([
    archiveWriteQueue,
    activeWriteQueue,
    backgroundWriteQueue,
  ]);
  await AsyncStorage.multiRemove([
    ARCHIVE_KEY,
    ACTIVE_TRACK_KEY,
    BACKGROUND_BUFFER_KEY,
  ]);
}
