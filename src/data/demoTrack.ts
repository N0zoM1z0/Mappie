import publicWalk from "../../fixtures/osm-rochdale-canal-walk.json";

import type { Track } from "../core/types";

export const DEMO_SOURCE_URL = publicWalk.sourceUrl;

export const demoTrack: Track = {
  id: "demo-osm-rochdale-canal",
  name: publicWalk.name,
  source: "demo",
  createdAt: Date.parse(publicWalk.points[0]!.time),
  points: publicWalk.points.map((point) => ({
    latitude: point.latitude,
    longitude: point.longitude,
    elevation: point.elevation,
    timestamp: Date.parse(point.time),
  })),
};
