import { describe, expect, it } from "vitest";

import {
  fitTrackViewport,
  pointsToPath,
  projectTracks,
  projectTracksToViewport,
} from "../src/core/projection";
import { demoSessions, demoTrack } from "../src/data/demoTrack";

describe("blank-map projection", () => {
  it("fits all public trace points inside the requested viewport", () => {
    const result = projectTracks([demoTrack], 390, 600, 30);
    const points = result.tracks[0]!.points;
    expect(points).toHaveLength(demoTrack.points.length);
    expect(points.every((point) => point.x >= 30 && point.x <= 360)).toBe(true);
    expect(points.every((point) => point.y >= 30 && point.y <= 570)).toBe(true);
    expect(result.metersPerPixel).toBeGreaterThan(0);
  });

  it("creates an SVG path without leaking map-provider geometry", () => {
    expect(
      pointsToPath([
        { x: 1, y: 2 },
        { x: 3.5, y: 4 },
      ]),
    ).toBe("M 1.00 2.00 L 3.50 4.00");
  });

  it("reuses a fitted viewport without changing projected geometry", () => {
    const fitTracks = demoSessions.slice(0, 3).map((session) => session.track);
    const viewport = fitTrackViewport(fitTracks, 390, 600, 30);

    expect(projectTracksToViewport([demoTrack], viewport)).toEqual(
      projectTracks([demoTrack], 390, 600, 30, fitTracks),
    );
  });

  it("fits every public fixture at a phone-sized viewport", () => {
    for (const { track } of demoSessions) {
      const result = projectTracks([track], 390, 480, 30);
      const points = result.tracks[0]!.points;
      expect(
        points.every((point) => point.x >= 29.999 && point.x <= 360.001),
      ).toBe(true);
      expect(
        points.every((point) => point.y >= 29.999 && point.y <= 450.001),
      ).toBe(true);
    }
  });
});
