import { IndexedDbKeyValueStore } from "./indexedDbKeyValueStore";
import {
  createExplorationStorage,
  EXPLORATION_STORAGE_KEYS,
} from "./storageRepository";
import type { ExplorationStorageStatus } from "./storageTypes";

const store = new IndexedDbKeyValueStore({
  databaseName: "mappie",
  indexedDB: () => globalThis.indexedDB,
  legacyKeys: EXPLORATION_STORAGE_KEYS,
  legacyStorage: () => globalThis.localStorage,
  migrationKey: "@mappie/migrations/localstorage-to-indexeddb/v1",
  storeName: "exploration",
});
const repository = createExplorationStorage(store);

export const appendBackgroundPoints = repository.appendBackgroundPoints;
export const clearActiveTrack = repository.clearActiveTrack;
export const clearAllExplorationData = repository.clearAllExplorationData;
export const drainBackgroundPoints = repository.drainBackgroundPoints;
export const loadActiveTrack = repository.loadActiveTrack;
export const loadArchive = repository.loadArchive;
export const saveActiveTrack = repository.saveActiveTrack;
export const saveArchive = repository.saveArchive;

async function browserStorageStatus(): Promise<
  Pick<
    ExplorationStorageStatus,
    "persisted" | "persistenceAvailable" | "quotaBytes"
  >
> {
  const manager = globalThis.navigator?.storage;
  if (!manager) {
    return {
      persisted: null,
      persistenceAvailable: false,
      quotaBytes: null,
    };
  }

  const [estimate, persisted] = await Promise.all([
    manager.estimate().catch(() => ({ quota: undefined, usage: undefined })),
    manager.persisted?.().catch(() => false) ?? Promise.resolve(false),
  ]);
  return {
    persisted,
    persistenceAvailable: typeof manager.persist === "function",
    quotaBytes: estimate.quota ?? null,
  };
}

export async function getStorageStatus(): Promise<ExplorationStorageStatus> {
  return {
    backend: "indexeddb",
    usedBytes: await repository.getStoredDataBytes(),
    ...(await browserStorageStatus()),
  };
}

export async function requestPersistentStorage(): Promise<ExplorationStorageStatus> {
  const manager = globalThis.navigator?.storage;
  if (manager?.persist) await manager.persist();
  return getStorageStatus();
}
