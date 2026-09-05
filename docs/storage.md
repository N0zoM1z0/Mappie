# Browser storage

Mappie's web archive is local to the browser origin. A deployment does not reset it, but another browser, device, hostname, or private-browsing session receives a separate archive.

## IndexedDB layout

The web adapter stores string records in the `exploration` object store of the `mappie` IndexedDB database. It preserves the existing versioned repository keys:

| Key                            | Contents                                 |
| ------------------------------ | ---------------------------------------- |
| `@mappie/archive/v1`           | Completed exploration sessions           |
| `@mappie/active-track/v1`      | The current or interrupted session       |
| `@mappie/background-buffer/v1` | Native background fixes awaiting a merge |

The storage toolbar reports the encoded size of these Mappie records, the browser's origin quota when available, and whether the origin is `BEST EFFORT` or `PERSISTENT`.

## localStorage migration

Earlier web releases used the React Native AsyncStorage web adapter, which placed the same keys in localStorage. On the first IndexedDB read, Mappie:

1. Opens the version 1 IndexedDB database.
2. Reads any legacy values without changing them.
3. Copies only keys that do not already exist in IndexedDB.
4. Writes a migration marker in the same IndexedDB transaction.
5. Removes copied localStorage values only after the transaction completes.

An interrupted or failed migration therefore leaves the legacy source intact. Existing IndexedDB data wins over a stale localStorage value.

## Storage protection

The `PROTECT` command calls `navigator.storage.persist()` from an explicit user action. Browsers decide whether to grant the request. A granted origin is protected from automatic storage-pressure eviction, while the user can still remove its site data manually.

When the API is unavailable or the browser declines the request, Mappie remains usable in best-effort mode. The toolbar keeps that state visible so a backup is not mistaken for optional housekeeping.

## Backup and restore

`BACKUP` downloads the complete personal map as `mappie-archive-YYYY-MM-DD.json`. The portable format includes:

- the `mappie-exploration-archive` format identifier;
- schema version 1;
- an ISO 8601 export timestamp;
- every track, point, segment boundary, timestamp, accuracy value, and elevation value in the archive.

`RESTORE` validates the format, version, dates, track shapes, finite coordinates, optional fields, and unique exploration IDs before writing anything. Restoring replaces the current personal map after confirmation. Files larger than 50 MB are rejected before parsing.

Recording and backup cannot run at the same time. If a final save fails because storage is full, the stopped in-memory track remains visible so it can still be included in a backup.

## Failure behavior

IndexedDB failures are classified as quota, unavailable-storage, or unknown errors. Archive commits are written before React state is updated, so a failed import or restore is not presented as saved. Active-session write failures are surfaced in the map status band instead of becoming unhandled promise rejections.

Browser storage solves multi-month capacity and recovery for foreground web use. Reliable collection while the screen is locked still belongs to the native location service, and cross-device synchronization would require a separate encrypted sync design.
