import { isTrackPoint, parseStoredArchive } from "../core/archive";
import type { ExplorationArchive, Track, TrackPoint } from "../core/types";

export const ARCHIVE_KEY = "@mappie/archive/v1";
export const ACTIVE_TRACK_KEY = "@mappie/active-track/v1";
export const BACKGROUND_BUFFER_KEY = "@mappie/background-buffer/v1";
export const EXPLORATION_STORAGE_KEYS = [
  ARCHIVE_KEY,
  ACTIVE_TRACK_KEY,
  BACKGROUND_BUFFER_KEY,
] as const;

export interface KeyValueStorage {
  getItem(key: string): Promise<string | null>;
  multiRemove(keys: readonly string[]): Promise<void>;
  removeItem(key: string): Promise<void>;
  setItem(key: string, value: string): Promise<void>;
}

function utf8ByteLength(value: string): number {
  let bytes = 0;
  for (const character of value) {
    const codePoint = character.codePointAt(0) ?? 0;
    bytes +=
      codePoint <= 0x7f
        ? 1
        : codePoint <= 0x7ff
          ? 2
          : codePoint <= 0xffff
            ? 3
            : 4;
  }
  return bytes;
}

export function createExplorationStorage(storage: KeyValueStorage) {
  let backgroundWriteQueue: Promise<void> = Promise.resolve();
  let archiveWriteQueue: Promise<void> = Promise.resolve();
  let activeWriteQueue: Promise<void> = Promise.resolve();

  async function loadArchive(): Promise<Track[]> {
    const raw = await storage.getItem(ARCHIVE_KEY);
    return raw ? parseStoredArchive(raw) : [];
  }

  async function saveArchive(tracks: Track[]): Promise<void> {
    const archive: ExplorationArchive = { version: 1, tracks };
    const write = archiveWriteQueue
      .catch(() => undefined)
      .then(() => storage.setItem(ARCHIVE_KEY, JSON.stringify(archive)));
    archiveWriteQueue = write.catch(() => undefined);
    await write;
  }

  async function loadActiveTrack(): Promise<Track | null> {
    const raw = await storage.getItem(ACTIVE_TRACK_KEY);
    if (!raw) return null;
    try {
      const archive = parseStoredArchive(
        JSON.stringify({ version: 1, tracks: [JSON.parse(raw)] }),
      );
      return archive[0] ?? null;
    } catch {
      return null;
    }
  }

  async function saveActiveTrack(track: Track): Promise<void> {
    const write = activeWriteQueue
      .catch(() => undefined)
      .then(() => storage.setItem(ACTIVE_TRACK_KEY, JSON.stringify(track)));
    activeWriteQueue = write.catch(() => undefined);
    await write;
  }

  async function clearActiveTrack(): Promise<void> {
    const removal = activeWriteQueue
      .catch(() => undefined)
      .then(() => storage.removeItem(ACTIVE_TRACK_KEY));
    activeWriteQueue = removal.catch(() => undefined);
    await removal;
  }

  function appendBackgroundPoints(points: TrackPoint[]): Promise<void> {
    const write = backgroundWriteQueue
      .catch(() => undefined)
      .then(async () => {
        const raw = await storage.getItem(BACKGROUND_BUFFER_KEY);
        let buffered: TrackPoint[] = [];
        if (raw) {
          try {
            const parsed: unknown = JSON.parse(raw);
            if (Array.isArray(parsed)) buffered = parsed.filter(isTrackPoint);
          } catch {
            buffered = [];
          }
        }
        await storage.setItem(
          BACKGROUND_BUFFER_KEY,
          JSON.stringify([...buffered, ...points]),
        );
      });
    backgroundWriteQueue = write.catch(() => undefined);
    return write;
  }

  function drainBackgroundPoints(): Promise<TrackPoint[]> {
    let result: TrackPoint[] = [];
    const drain = backgroundWriteQueue
      .catch(() => undefined)
      .then(async () => {
        const raw = await storage.getItem(BACKGROUND_BUFFER_KEY);
        await storage.removeItem(BACKGROUND_BUFFER_KEY);
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

  async function clearAllExplorationData(): Promise<void> {
    await Promise.all([
      archiveWriteQueue,
      activeWriteQueue,
      backgroundWriteQueue,
    ]);
    await storage.multiRemove(EXPLORATION_STORAGE_KEYS);
  }

  async function getStoredDataBytes(): Promise<number> {
    const values = await Promise.all(
      EXPLORATION_STORAGE_KEYS.map((key) => storage.getItem(key)),
    );
    return values.reduce(
      (sum, value) => sum + (value ? utf8ByteLength(value) : 0),
      0,
    );
  }

  return {
    appendBackgroundPoints,
    clearActiveTrack,
    clearAllExplorationData,
    drainBackgroundPoints,
    getStoredDataBytes,
    loadActiveTrack,
    loadArchive,
    saveActiveTrack,
    saveArchive,
  };
}

export type ExplorationStorageRepository = ReturnType<
  typeof createExplorationStorage
>;
