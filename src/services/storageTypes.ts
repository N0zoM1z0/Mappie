export type ExplorationStorageBackend = "async-storage" | "indexeddb";
export type ExplorationStorageErrorCode =
  "quota-exceeded" | "unavailable" | "unknown";

export interface ExplorationStorageStatus {
  backend: ExplorationStorageBackend;
  persistenceAvailable: boolean;
  persisted: boolean | null;
  quotaBytes: number | null;
  usedBytes: number;
}

export class ExplorationStorageError extends Error {
  constructor(
    public readonly code: ExplorationStorageErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "ExplorationStorageError";
  }
}

function errorName(error: unknown): string | undefined {
  if (!error || typeof error !== "object" || !("name" in error)) return;
  return typeof error.name === "string" ? error.name : undefined;
}

export function toExplorationStorageError(
  error: unknown,
  operation: "read" | "write",
): ExplorationStorageError {
  if (error instanceof ExplorationStorageError) return error;

  const name = errorName(error);
  if (name === "QuotaExceededError" || name === "NS_ERROR_DOM_QUOTA_REACHED") {
    return new ExplorationStorageError(
      "quota-exceeded",
      "Local storage is full. Back up the archive before freeing browser storage.",
      error instanceof Error ? { cause: error } : undefined,
    );
  }
  if (
    name === "InvalidStateError" ||
    name === "NotAllowedError" ||
    name === "SecurityError"
  ) {
    return new ExplorationStorageError(
      "unavailable",
      "Local storage is unavailable in this browser session.",
      error instanceof Error ? { cause: error } : undefined,
    );
  }

  return new ExplorationStorageError(
    "unknown",
    `Mappie could not ${operation} the local archive.`,
    error instanceof Error ? { cause: error } : undefined,
  );
}

export function storageErrorMessage(error: unknown): string {
  return toExplorationStorageError(error, "write").message;
}
