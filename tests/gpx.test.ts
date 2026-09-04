import { describe, expect, it } from "vitest";

import { parseGPX } from "../src/core/gpx";

describe("GPX parser", () => {
  it("reads namespaced track points and metadata", () => {
    const track = parseGPX(`
      <?xml version="1.0"?>
      <gpx xmlns="http://www.topografix.com/GPX/1/1" version="1.1">
        <metadata><name>Morning exploration</name></metadata>
        <trk><name>Canal path</name><trkseg>
          <trkpt lat="53.55" lon="-2.16"><ele>101.5</ele><time>2026-09-04T10:00:00Z</time></trkpt>
          <trkpt lat="53.551" lon="-2.161"><time>2026-09-04T10:01:00Z</time></trkpt>
        </trkseg></trk>
      </gpx>
    `);

    expect(track.name).toBe("Canal path");
    expect(track.points).toHaveLength(2);
    expect(track.points[0]).toMatchObject({
      latitude: 53.55,
      longitude: -2.16,
      elevation: 101.5,
    });
  });

  it("falls back to route points", () => {
    const track = parseGPX(
      '<gpx><rte><rtept lat="25" lon="121" /></rte></gpx>',
      "Route",
    );
    expect(track.name).toBe("Route");
    expect(track.points).toHaveLength(1);
  });

  it("rejects documents without usable points", () => {
    expect(() => parseGPX("<gpx><metadata /></gpx>")).toThrow(
      /no track or route points/i,
    );
  });

  it("preserves boundaries between GPX segments", () => {
    const track = parseGPX(`
      <gpx><trk>
        <trkseg><trkpt lat="1" lon="1" /><trkpt lat="1.1" lon="1.1" /></trkseg>
        <trkseg><trkpt lat="2" lon="2" /><trkpt lat="2.1" lon="2.1" /></trkseg>
      </trk></gpx>
    `);
    expect(track.points.map((point) => point.segmentStart ?? false)).toEqual([
      false,
      false,
      true,
      false,
    ]);
  });

  it("rejects malformed XML before parsing", () => {
    expect(() => parseGPX("<gpx><trk>")).toThrow(/unable to parse/i);
  });
});
