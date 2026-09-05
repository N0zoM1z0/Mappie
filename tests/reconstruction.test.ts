import { describe, expect, it } from "vitest";

import {
  reconstructMap,
  reconstructionTracks,
} from "../src/core/reconstruction";
import type { Track } from "../src/core/types";

const latitude = 52.2;
const metersPerLongitude = 111_320 * Math.cos((latitude * Math.PI) / 180);

function track(id: string, coordinates: Array<[number, number]>): Track {
  return {
    createdAt: 0,
    id,
    name: id,
    points: coordinates.map(([x, y], index) => ({
      latitude: latitude + y / 111_320,
      longitude: x / metersPerLongitude,
      timestamp: index * 10_000,
    })),
    source: "demo",
  };
}

describe("trajectory reconstruction", () => {
  it("merges a noisy repeat into the first observed path", () => {
    const first = track("first", [
      [0, 0],
      [50, 0],
      [100, 0],
    ]);
    const repeat = track("repeat", [
      [0, 4],
      [48, 3],
      [100, 5],
    ]);
    const oneSession = reconstructMap([first]);
    const twoSessions = reconstructMap([first, repeat]);

    expect(twoSessions.knownDistanceMeters).toBeLessThan(
      oneSession.knownDistanceMeters * 1.4,
    );
    expect(twoSessions.edges.some((edge) => edge.visitCount === 2)).toBe(true);
    expect(twoSessions.sessions[1]!.revisitedDistanceMeters).toBeGreaterThan(
      twoSessions.sessions[1]!.newDistanceMeters,
    );
    expect(twoSessions.confidence).toBeGreaterThan(oneSession.confidence);
  });

  it("adds a branch without losing the confirmed shared path", () => {
    const result = reconstructMap([
      track("west-east", [
        [0, 0],
        [100, 0],
      ]),
      track("repeat", [
        [0, 3],
        [100, 3],
      ]),
      track("branch", [
        [50, 2],
        [50, 80],
      ]),
    ]);

    expect(result.sessions[2]!.newDistanceMeters).toBeGreaterThan(50);
    expect(result.intersectionCount).toBeGreaterThan(0);
    expect(result.edges.some((edge) => edge.visitCount >= 2)).toBe(true);
    expect(reconstructionTracks(result, 2)).toHaveLength(
      result.edges.filter((edge) => edge.firstSeenSession < 2).length,
    );
  });

  it("returns an empty map for an empty archive", () => {
    expect(reconstructMap([])).toEqual({
      confidence: 0,
      edges: [],
      intersectionCount: 0,
      knownDistanceMeters: 0,
      nodes: [],
      sessions: [],
    });
  });
});
