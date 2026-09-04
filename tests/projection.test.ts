import { describe, expect, it } from "vitest";

import { pointsToPath, projectTracks } from "../src/core/projection";
import { demoTrack } from "../src/data/demoTrack";

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
});
