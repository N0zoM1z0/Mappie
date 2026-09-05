import scenario from "../../fixtures/osm-cambridge-sessions.json";

import type { Track } from "../core/types";

export type DemoActivity = "RIDE" | "RUN" | "SURVEY" | "WALK";

export interface DemoSession {
  activity: DemoActivity;
  areaPointCount: number;
  sampledPointCount: number;
  sourcePointCount: number;
  sourceUrl: string;
  traceId: number;
  track: Track;
  visibility: "IDENTIFIABLE" | "PUBLIC";
}

interface PublicTraceFixture {
  activity: string;
  areaPointCount: number;
  name: string;
  points: Array<{
    elevation?: number;
    latitude: number;
    longitude: number;
    segmentStart?: boolean;
    time: string;
  }>;
  sequence: number;
  sourcePointCount: number;
  sourceUrl: string;
  traceId: number;
  visibility: string;
}

function makeSession(fixture: PublicTraceFixture): DemoSession {
  const { sequence } = fixture;
  const points = fixture.points.map((point) => ({
    elevation: point.elevation,
    latitude: point.latitude,
    longitude: point.longitude,
    segmentStart: point.segmentStart,
    timestamp: Date.parse(point.time) + sequence * 86_400_000,
  }));
  return {
    activity: fixture.activity as DemoActivity,
    areaPointCount: fixture.areaPointCount,
    sampledPointCount: points.length,
    sourcePointCount: fixture.sourcePointCount,
    sourceUrl: fixture.sourceUrl,
    traceId: fixture.traceId,
    track: {
      createdAt: points[0]!.timestamp,
      id: `demo-cambridge-${String(sequence).padStart(2, "0")}`,
      name: fixture.name,
      points,
      source: "demo",
    },
    visibility: fixture.visibility as "IDENTIFIABLE" | "PUBLIC",
  };
}

export const demoSessions = (scenario.sessions as PublicTraceFixture[]).map(
  makeSession,
);

export const demoTrack = demoSessions[0]!.track;
export const DEMO_SOURCE_URL = demoSessions[0]!.sourceUrl;
export const DEMO_AREA_LABEL = "CAMBRIDGE / WEST CENTRAL";
