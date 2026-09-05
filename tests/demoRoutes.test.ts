import { describe, expect, it } from "vitest";

import { demoRoutes } from "../src/data/demoTrack";

describe("public demo route registry", () => {
  it("includes six distinct, attributed OpenStreetMap traces", () => {
    expect(demoRoutes).toHaveLength(6);
    expect(new Set(demoRoutes.map((route) => route.traceId)).size).toBe(6);
    expect(demoRoutes.every((route) => route.visibility === "PUBLIC")).toBe(
      true,
    );
    expect(
      demoRoutes.every((route) =>
        route.sourceUrl.endsWith(`/traces/${route.traceId}`),
      ),
    ).toBe(true);
  });

  it("keeps source counts while bounding replay geometry", () => {
    expect(
      demoRoutes.every(
        (route) =>
          route.originalPointCount >= route.sampledPointCount &&
          route.track.points.length === route.sampledPointCount &&
          route.sampledPointCount <= 240,
      ),
    ).toBe(true);
  });

  it("gives every route optional discoveries before its target", () => {
    expect(
      demoRoutes.every(
        (route) =>
          route.discoveries.length >= 3 &&
          route.discoveries.every(
            (discovery) => discovery.progress > 0 && discovery.progress < 1,
          ),
      ),
    ).toBe(true);
  });
});
