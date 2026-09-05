import { describe, expect, it } from "vitest";

import type { Track } from "../src/core/types";
import {
  ARCHIVE_KEY,
  createExplorationStorage,
  type KeyValueStorage,
} from "../src/services/storageRepository";
import {
  ExplorationStorageError,
  toExplorationStorageError,
} from "../src/services/storageTypes";

function memoryStorage(): KeyValueStorage & { values: Map<string, string> } {
  const values = new Map<string, string>();
  return {
    values,
    async getItem(key) {
      return values.get(key) ?? null;
    },
    async setItem(key, value) {
      values.set(key, value);
    },
    async removeItem(key) {
      values.delete(key);
    },
    async multiRemove(keys) {
      keys.forEach((key) => values.delete(key));
    },
  };
}

const track: Track = {
  createdAt: 1,
  id: "walk-1",
  name: "Walk 1",
  points: [
    { latitude: 1, longitude: 2, timestamp: 1 },
    { latitude: 1.001, longitude: 2.001, timestamp: 2 },
  ],
  source: "live",
};

describe("exploration storage repository", () => {
  it("persists a versioned archive and reports its encoded size", async () => {
    const storage = memoryStorage();
    const repository = createExplorationStorage(storage);

    await repository.saveArchive([track]);

    expect(await repository.loadArchive()).toEqual([track]);
    expect(JSON.parse(storage.values.get(ARCHIVE_KEY) ?? "")).toEqual({
      tracks: [track],
      version: 1,
    });
    expect(await repository.getStoredDataBytes()).toBeGreaterThan(100);
  });

  it("serializes background appends without dropping points", async () => {
    const repository = createExplorationStorage(memoryStorage());
    await Promise.all([
      repository.appendBackgroundPoints([track.points[0]!]),
      repository.appendBackgroundPoints([track.points[1]!]),
    ]);
    expect(await repository.drainBackgroundPoints()).toEqual(track.points);
    expect(await repository.drainBackgroundPoints()).toEqual([]);
  });

  it("classifies browser quota failures", () => {
    const quotaError = new Error("full");
    quotaError.name = "QuotaExceededError";
    const error = toExplorationStorageError(quotaError, "write");

    expect(error).toBeInstanceOf(ExplorationStorageError);
    expect(error.code).toBe("quota-exceeded");
    expect(error.message).toMatch(/storage is full/i);
  });

  it("surfaces a quota failure and accepts a later archive write", async () => {
    const storage = memoryStorage();
    let shouldFail = true;
    const originalSetItem = storage.setItem;
    storage.setItem = async (key, value) => {
      if (shouldFail) {
        shouldFail = false;
        const error = new Error("full");
        error.name = "QuotaExceededError";
        throw toExplorationStorageError(error, "write");
      }
      await originalSetItem(key, value);
    };
    const repository = createExplorationStorage(storage);

    await expect(repository.saveArchive([track])).rejects.toMatchObject({
      code: "quota-exceeded",
    });
    await expect(repository.saveArchive([track])).resolves.toBeUndefined();
    await expect(repository.loadArchive()).resolves.toEqual([track]);
  });
});
