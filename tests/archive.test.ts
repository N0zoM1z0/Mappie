import { describe, expect, it } from "vitest";

import {
  MAPPIE_ARCHIVE_FORMAT,
  parseMappieArchive,
  serializeMappieArchive,
} from "../src/core/archive";
import type { Track } from "../src/core/types";

const track: Track = {
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
      elevation: 14,
      latitude: 25.0175,
      longitude: 121.5401,
      segmentStart: true,
      timestamp: Date.parse("2026-09-05T09:01:00Z"),
    },
  ],
  source: "live",
};

describe("Mappie archive files", () => {
  it("round-trips every exploration field", () => {
    const contents = serializeMappieArchive(
      [track],
      new Date("2026-09-05T10:00:00Z"),
    );
    const archive = parseMappieArchive(contents);

    expect(archive).toEqual({
      exportedAt: "2026-09-05T10:00:00.000Z",
      format: MAPPIE_ARCHIVE_FORMAT,
      tracks: [track],
      version: 1,
    });
  });

  it("rejects unrelated, unsupported, and structurally invalid files", () => {
    expect(() => parseMappieArchive("not json")).toThrow(/valid JSON/i);
    expect(() =>
      parseMappieArchive(
        JSON.stringify({
          exportedAt: "2026-09-05T10:00:00.000Z",
          format: MAPPIE_ARCHIVE_FORMAT,
          tracks: [],
          version: 2,
        }),
      ),
    ).toThrow(/version 2/i);
    expect(() =>
      parseMappieArchive(
        JSON.stringify({
          exportedAt: "2026-09-05T10:00:00.000Z",
          format: MAPPIE_ARCHIVE_FORMAT,
          tracks: [{ ...track, points: [{ latitude: "invalid" }] }],
          version: 1,
        }),
      ),
    ).toThrow(/invalid exploration track/i);
  });

  it("rejects duplicate exploration IDs", () => {
    const contents = serializeMappieArchive([track, { ...track }]);
    expect(() => parseMappieArchive(contents)).toThrow(/duplicate/i);
  });
});
