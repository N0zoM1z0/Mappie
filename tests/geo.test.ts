import { describe, expect, it } from "vitest";

import {
  filterTrackPoints,
  haversineDistance,
  splitTrackAtGaps,
  trackDistance,
} from "../src/core/geo";
import type { TrackPoint } from "../src/core/types";
import { demoTrack } from "../src/data/demoTrack";

const point = (
  latitude: number,
  longitude: number,
  timestamp: number,
  accuracy = 5,
): TrackPoint => ({
  latitude,
  longitude,
  timestamp,
  accuracy,
});

describe("geospatial core", () => {
  it("computes a realistic distance for the public walking trace", () => {
    const distance = trackDistance(demoTrack.points);
    expect(distance).toBeGreaterThan(500);
    expect(distance).toBeLessThan(5_000);
  });

  it("filters invalid, inaccurate, stationary, and impossible points", () => {
    const base = Date.parse("2026-09-04T12:00:00Z");
    const report = filterTrackPoints([
      point(25.033, 121.5654, base),
      point(25.033001, 121.565401, base + 1_000),
      point(25.0332, 121.5656, base + 2_000, 120),
      point(91, 121.5656, base + 3_000),
      point(25.1, 121.6, base + 4_000),
      point(25.0331, 121.5655, base + 10_000),
    ]);

    expect(report.accepted).toHaveLength(2);
    expect(report.rejected).toEqual({
      inaccurate: 1,
      invalid: 1,
      tooClose: 1,
      tooFast: 1,
      nonMonotonic: 0,
    });
  });

  it("splits a track when recording has a long pause", () => {
    const points = [
      point(0, 0, 0),
      point(0, 0.0001, 10_000),
      point(0, 0.0002, 500_000),
    ];
    expect(
      splitTrackAtGaps(points, 60).map((segment) => segment.length),
    ).toEqual([2, 1]);
  });

  it("does not bridge explicit segment boundaries in distance totals", () => {
    const points = [
      point(0, 0, 0),
      point(0, 0.001, 10_000),
      { ...point(20, 20, 11_000), segmentStart: true },
      point(20, 20.001, 21_000),
    ];
    expect(trackDistance(points)).toBeGreaterThan(200);
    expect(trackDistance(points)).toBeLessThan(230);
    expect(splitTrackAtGaps(points)).toHaveLength(2);
  });

  it("returns zero for identical coordinates", () => {
    const same = point(35, 139, 0);
    expect(haversineDistance(same, same)).toBe(0);
  });
});
