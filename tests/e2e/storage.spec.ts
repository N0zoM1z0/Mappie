import { expect, test } from "@playwright/test";

import { MAPPIE_ARCHIVE_FORMAT } from "../../src/core/archive";
import type { Track } from "../../src/core/types";

const ARCHIVE_KEY = "@mappie/archive/v1";
const campusTrack: Track = {
  createdAt: Date.parse("2026-09-05T09:00:00Z"),
  id: "campus-loop",
  name: "Campus loop",
  points: [
    {
      accuracy: 4,
      latitude: 25.0173,
      longitude: 121.5398,
      timestamp: Date.parse("2026-09-05T09:00:00Z"),
    },
    {
      accuracy: 5,
      latitude: 25.0176,
      longitude: 121.5402,
      timestamp: Date.parse("2026-09-05T09:01:00Z"),
    },
  ],
  source: "live",
};

test("migrates legacy browser data and downloads a complete backup", async ({
  page,
}) => {
  const storedArchive = JSON.stringify({ tracks: [campusTrack], version: 1 });
  await page.addInitScript(
    ({ archiveKey, archiveValue }) => {
      localStorage.setItem(archiveKey, archiveValue);
      let persisted = false;
      Object.defineProperty(navigator, "storage", {
        configurable: true,
        value: {
          estimate: async () => ({ quota: 1024 * 1024 }),
          persist: async () => {
            persisted = true;
            return true;
          },
          persisted: async () => persisted,
        },
      });
    },
    { archiveKey: ARCHIVE_KEY, archiveValue: storedArchive },
  );

  await page.goto("/");
  await page.getByRole("tab", { name: "MY MAP" }).click();
  await expect(page.getByText("Campus loop", { exact: true })).toBeVisible();
  await expect(page.getByText(/BROWSER ARCHIVE \/ INDEXEDDB/)).toBeVisible();
  await expect(page.getByText(/BEST EFFORT/)).toBeVisible();
  expect(
    await page.evaluate((key) => localStorage.getItem(key), ARCHIVE_KEY),
  ).toBeNull();

  const indexedArchive = await page.evaluate(
    ({ databaseName, key, storeName }) =>
      new Promise<string | null>((resolve, reject) => {
        const open = indexedDB.open(databaseName);
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const transaction = open.result.transaction(storeName, "readonly");
          const request = transaction.objectStore(storeName).get(key);
          request.onerror = () => reject(request.error);
          request.onsuccess = () =>
            resolve(typeof request.result === "string" ? request.result : null);
        };
      }),
    { databaseName: "mappie", key: ARCHIVE_KEY, storeName: "exploration" },
  );
  expect(indexedArchive).toBe(storedArchive);

  await page.getByRole("button", { name: "Protect browser storage" }).click();
  await expect(page.getByText(/PERSISTENT/)).toBeVisible();
  await expect(page.getByText(/storage protection is active/i)).toBeVisible();

  await page.evaluate(() => {
    const original = URL.createObjectURL.bind(URL);
    URL.createObjectURL = (object) => {
      if (object instanceof Blob) {
        void object.text().then((contents) => {
          (
            globalThis as typeof globalThis & {
              __mappieDownloadText?: string;
            }
          ).__mappieDownloadText = contents;
        });
      }
      return original(object);
    };
  });
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Back up Mappie archive" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(
    /^mappie-archive-\d{4}-\d{2}-\d{2}\.json$/,
  );
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (
            globalThis as typeof globalThis & {
              __mappieDownloadText?: string;
            }
          ).__mappieDownloadText ?? null,
      ),
    )
    .not.toBeNull();
  const backupText = await page.evaluate(
    () =>
      (
        globalThis as typeof globalThis & {
          __mappieDownloadText?: string;
        }
      ).__mappieDownloadText!,
  );
  const backup = JSON.parse(backupText);
  expect(backup).toMatchObject({
    format: MAPPIE_ARCHIVE_FORMAT,
    tracks: [campusTrack],
    version: 1,
  });
});

test("restores an archive and keeps it across reloads", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("tab", { name: "MY MAP" }).click();

  const fileChooserPromise = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Restore Mappie archive" }).click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles("tests/fixtures/campus-archive.json");

  await expect(page.getByText(/Restored 1 exploration session/)).toBeVisible();
  await expect(page.getByText("Campus loop", { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole("tab", { name: "MY MAP" }).click();
  await expect(page.getByText("Campus loop", { exact: true })).toBeVisible();
});
