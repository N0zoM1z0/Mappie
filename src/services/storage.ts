import AsyncStorage from "@react-native-async-storage/async-storage";

import { createExplorationStorage } from "./storageRepository";
import {
  toExplorationStorageError,
  type ExplorationStorageStatus,
} from "./storageTypes";

const repository = createExplorationStorage({
  async getItem(key) {
    try {
      return await AsyncStorage.getItem(key);
    } catch (error) {
      throw toExplorationStorageError(error, "read");
    }
  },
  async setItem(key, value) {
    try {
      await AsyncStorage.setItem(key, value);
    } catch (error) {
      throw toExplorationStorageError(error, "write");
    }
  },
  async removeItem(key) {
    try {
      await AsyncStorage.removeItem(key);
    } catch (error) {
      throw toExplorationStorageError(error, "write");
    }
  },
  async multiRemove(keys) {
    try {
      await AsyncStorage.multiRemove([...keys]);
    } catch (error) {
      throw toExplorationStorageError(error, "write");
    }
  },
});

export const appendBackgroundPoints = repository.appendBackgroundPoints;
export const clearActiveTrack = repository.clearActiveTrack;
export const clearAllExplorationData = repository.clearAllExplorationData;
export const drainBackgroundPoints = repository.drainBackgroundPoints;
export const loadActiveTrack = repository.loadActiveTrack;
export const loadArchive = repository.loadArchive;
export const saveActiveTrack = repository.saveActiveTrack;
export const saveArchive = repository.saveArchive;

export async function getStorageStatus(): Promise<ExplorationStorageStatus> {
  return {
    backend: "async-storage",
    persistenceAvailable: false,
    persisted: true,
    quotaBytes: null,
    usedBytes: await repository.getStoredDataBytes(),
  };
}

export function requestPersistentStorage(): Promise<ExplorationStorageStatus> {
  return getStorageStatus();
}
