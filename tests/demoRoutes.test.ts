import { describe, expect, it } from "vitest";

import { reconstructMap } from "../src/core/reconstruction";
import { demoSessions } from "../src/data/demoTrack";

describe("public reconstruction scenario", () => {
  it("contains seventy attributed sessions from the same Cambridge neighborhood", () => {
    expect(demoSessions).toHaveLength(70);
    expect(new Set(demoSessions.map((session) => session.traceId)).size).toBe(
      70,
    );
    expect(
      demoSessions.every(
        (session) =>
          session.visibility === "IDENTIFIABLE" ||
          session.visibility === "PUBLIC",
      ),
    ).toBe(true);
    expect(
      demoSessions.every((session) =>
        session.sourceUrl.endsWith(`/traces/${session.traceId}`),
      ),
    ).toBe(true);
    expect(
      demoSessions
        .flatMap((session) => session.track.points)
        .every(
          (point) =>
            point.longitude >= 0.111 &&
            point.longitude <= 0.126 &&
            point.latitude >= 52.2 &&
            point.latitude <= 52.209,
        ),
    ).toBe(true);
  });

  it("keeps source and area counts while bounding mobile geometry", () => {
    expect(
      demoSessions.every(
        (session) =>
          session.sourcePointCount >= session.areaPointCount &&
          session.areaPointCount >= session.sampledPointCount &&
          session.track.points.length === session.sampledPointCount &&
          session.sampledPointCount <= 300,
      ),
    ).toBe(true);
    expect(
      demoSessions.every((session) =>
        session.track.points.some((point) => point.segmentStart),
      ),
    ).toBe(true);
    expect(
      demoSessions.reduce(
        (total, session) => total + session.sourcePointCount,
        0,
      ),
    ).toBe(567_637);
    expect(
      demoSessions.reduce(
        (total, session) => total + session.areaPointCount,
        0,
      ),
    ).toBe(34_024);
    expect(
      demoSessions.reduce(
        (total, session) => total + session.sampledPointCount,
        0,
      ),
    ).toBe(14_510);
  });

  it("contains real revisits as well as sessions that add new edges", () => {
    const result = reconstructMap(demoSessions.map((session) => session.track));
    expect(result.edges.some((edge) => edge.visitCount >= 2)).toBe(true);
    expect(
      result.sessions.some((session) => session.revisitedDistanceMeters > 0),
    ).toBe(true);
    expect(
      result.sessions.filter((session) => session.newDistanceMeters > 0).length,
    ).toBeGreaterThan(demoSessions.length / 2);
    expect(
      result.sessions.some(
        (session) =>
          session.revisitedDistanceMeters > session.newDistanceMeters,
      ),
    ).toBe(true);
  });
});
