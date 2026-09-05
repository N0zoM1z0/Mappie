import {
  ExplorationStorageError,
  toExplorationStorageError,
} from "./storageTypes";
import type { KeyValueStorage } from "./storageRepository";

interface LegacyStorage {
  getItem(key: string): string | null;
  removeItem(key: string): void;
}

interface IndexedDbKeyValueStoreOptions {
  databaseName: string;
  indexedDB: () => IDBFactory | undefined;
  legacyKeys: readonly string[];
  legacyStorage: () => LegacyStorage | null;
  migrationKey: string;
  storeName: string;
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionComplete(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error);
    transaction.onerror = () => reject(transaction.error);
  });
}

export class IndexedDbKeyValueStore implements KeyValueStorage {
  private readyPromise: Promise<IDBDatabase> | null = null;

  constructor(private readonly options: IndexedDbKeyValueStoreOptions) {}

  async getItem(key: string): Promise<string | null> {
    try {
      const database = await this.ready();
      return await this.read(database, key);
    } catch (error) {
      throw toExplorationStorageError(error, "read");
    }
  }

  async setItem(key: string, value: string): Promise<void> {
    try {
      const database = await this.ready();
      const transaction = database.transaction(
        this.options.storeName,
        "readwrite",
      );
      const complete = transactionComplete(transaction);
      await requestResult(
        transaction.objectStore(this.options.storeName).put(value, key),
      );
      await complete;
    } catch (error) {
      throw toExplorationStorageError(error, "write");
    }
  }

  async removeItem(key: string): Promise<void> {
    await this.multiRemove([key]);
  }

  async multiRemove(keys: readonly string[]): Promise<void> {
    try {
      const database = await this.ready();
      const transaction = database.transaction(
        this.options.storeName,
        "readwrite",
      );
      const complete = transactionComplete(transaction);
      const store = transaction.objectStore(this.options.storeName);
      await Promise.all(keys.map((key) => requestResult(store.delete(key))));
      await complete;
    } catch (error) {
      throw toExplorationStorageError(error, "write");
    }
  }

  private ready(): Promise<IDBDatabase> {
    this.readyPromise ??= this.open().then(async (database) => {
      await this.migrateLegacyStorage(database);
      return database;
    });
    return this.readyPromise;
  }

  private open(): Promise<IDBDatabase> {
    const factory = this.options.indexedDB();
    if (!factory) {
      return Promise.reject(
        new ExplorationStorageError(
          "unavailable",
          "IndexedDB is unavailable in this browser session.",
        ),
      );
    }

    return new Promise((resolve, reject) => {
      const request = factory.open(this.options.databaseName, 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(this.options.storeName)) {
          request.result.createObjectStore(this.options.storeName);
        }
      };
      request.onsuccess = () => {
        request.result.onversionchange = () => request.result.close();
        resolve(request.result);
      };
      request.onerror = () => reject(request.error);
      request.onblocked = () =>
        reject(
          new ExplorationStorageError(
            "unavailable",
            "Another Mappie tab is blocking the storage upgrade.",
          ),
        );
    });
  }

  private async read(
    database: IDBDatabase,
    key: string,
  ): Promise<string | null> {
    const transaction = database.transaction(
      this.options.storeName,
      "readonly",
    );
    const complete = transactionComplete(transaction);
    const value = await requestResult(
      transaction.objectStore(this.options.storeName).get(key),
    );
    await complete;
    return typeof value === "string" ? value : null;
  }

  private async migrateLegacyStorage(database: IDBDatabase): Promise<void> {
    if ((await this.read(database, this.options.migrationKey)) === "1") return;

    let legacyStorage: LegacyStorage | null = null;
    try {
      legacyStorage = this.options.legacyStorage();
    } catch {
      legacyStorage = null;
    }

    const legacyValues = new Map<string, string>();
    if (legacyStorage) {
      for (const key of this.options.legacyKeys) {
        try {
          const value = legacyStorage.getItem(key);
          if (value !== null) legacyValues.set(key, value);
        } catch {
          // IndexedDB remains usable even when legacy Web Storage is blocked.
        }
      }
    }

    const existingValues = new Map<string, string | null>();
    await Promise.all(
      this.options.legacyKeys.map(async (key) => {
        existingValues.set(key, await this.read(database, key));
      }),
    );

    const transaction = database.transaction(
      this.options.storeName,
      "readwrite",
    );
    const complete = transactionComplete(transaction);
    const store = transaction.objectStore(this.options.storeName);
    const writes: Promise<unknown>[] = [];
    for (const [key, value] of legacyValues) {
      if (existingValues.get(key) === null) {
        writes.push(requestResult(store.put(value, key)));
      }
    }
    writes.push(requestResult(store.put("1", this.options.migrationKey)));
    await Promise.all(writes);
    await complete;

    if (legacyStorage) {
      for (const key of legacyValues.keys()) {
        try {
          legacyStorage.removeItem(key);
        } catch {
          // The migration marker prevents stale values from being imported twice.
        }
      }
    }
  }
}
