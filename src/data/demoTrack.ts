import arcticWalk from "../../fixtures/osm-arctic-walking-loop.json";
import branchedRun from "../../fixtures/osm-branched-morning-run.json";
import forestHike from "../../fixtures/osm-forest-hiking-traverse.json";
import mountainRide from "../../fixtures/osm-mountain-bike-loop.json";
import rochdaleWalk from "../../fixtures/osm-rochdale-canal-walk.json";
import urbanRun from "../../fixtures/osm-urban-running-loop.json";

import type { Track } from "../core/types";

export type DemoActivity = "WALK" | "HIKE" | "RUN" | "RIDE";
export type DemoDiscoveryKind = "question" | "friend";

export interface DemoDiscovery {
  detail: string;
  id: string;
  kind: DemoDiscoveryKind;
  progress: number;
  title: string;
}

export interface DemoRoute {
  activity: DemoActivity;
  discoveries: DemoDiscovery[];
  originalPointCount: number;
  sampledPointCount: number;
  sourceUrl: string;
  traceId: number;
  track: Track;
  visibility: "PUBLIC";
}

interface PublicTraceFixture {
  activity: string;
  name: string;
  originalPointCount: number;
  points: Array<{
    elevation?: number;
    latitude: number;
    longitude: number;
    time: string;
  }>;
  sourceUrl: string;
  traceId: number;
  visibility: string;
}

function makeRoute(
  fixture: PublicTraceFixture,
  slug: string,
  discoveries: DemoDiscovery[],
): DemoRoute {
  const points = fixture.points.map((point) => ({
    elevation: point.elevation,
    latitude: point.latitude,
    longitude: point.longitude,
    timestamp: Date.parse(point.time),
  }));
  return {
    activity: fixture.activity as DemoActivity,
    discoveries,
    originalPointCount: fixture.originalPointCount,
    sampledPointCount: points.length,
    sourceUrl: fixture.sourceUrl,
    traceId: fixture.traceId,
    track: {
      createdAt: points[0]!.timestamp,
      id: `demo-osm-${slug}`,
      name: fixture.name,
      points,
      source: "demo",
    },
    visibility: fixture.visibility as "PUBLIC",
  };
}

export const demoRoutes: DemoRoute[] = [
  makeRoute(rochdaleWalk, "rochdale-canal", [
    {
      detail: "A crossing appears just beyond the known line.",
      id: "rochdale-crossing",
      kind: "question",
      progress: 0.24,
      title: "Unmarked crossing",
    },
    {
      detail: "Another explorer briefly shares the towpath.",
      id: "rochdale-mapper",
      kind: "friend",
      progress: 0.53,
      title: "Passing mapper",
    },
    {
      detail: "The trace bends away from its obvious direction.",
      id: "rochdale-turn",
      kind: "question",
      progress: 0.78,
      title: "Canal turn",
    },
  ]),
  makeRoute(arcticWalk, "arctic-walk", [
    {
      detail: "A narrow connection becomes visible along the long edge.",
      id: "arctic-link",
      kind: "question",
      progress: 0.2,
      title: "Side connection",
    },
    {
      detail: "A local observer adds one line to the route memory.",
      id: "arctic-local",
      kind: "friend",
      progress: 0.49,
      title: "Local observer",
    },
    {
      detail: "The final leg hides a second approach to the loop.",
      id: "arctic-approach",
      kind: "question",
      progress: 0.76,
      title: "Second approach",
    },
  ]),
  makeRoute(forestHike, "forest-hike", [
    {
      detail: "A weak signal sits close to the first trail bend.",
      id: "forest-signal",
      kind: "question",
      progress: 0.19,
      title: "Trail signal",
    },
    {
      detail: "A field mapper confirms the long traverse is passable.",
      id: "forest-mapper",
      kind: "friend",
      progress: 0.47,
      title: "Field mapper",
    },
    {
      detail: "A return spur is easy to miss in the dense trace.",
      id: "forest-spur",
      kind: "question",
      progress: 0.74,
      title: "Hidden spur",
    },
  ]),
  makeRoute(branchedRun, "branched-run", [
    {
      detail: "A branch opens away from the direct route to the target.",
      id: "branched-detour",
      kind: "question",
      progress: 0.18,
      title: "Optional detour",
    },
    {
      detail: "A runner becomes part of this expedition's memory.",
      id: "branched-runner",
      kind: "friend",
      progress: 0.46,
      title: "Distance runner",
    },
    {
      detail: "The returning line reconnects two explored branches.",
      id: "branched-return",
      kind: "question",
      progress: 0.73,
      title: "Branch return",
    },
  ]),
  makeRoute(urbanRun, "urban-run", [
    {
      detail: "A junction invites a detour before the main objective.",
      id: "urban-junction",
      kind: "question",
      progress: 0.22,
      title: "Open junction",
    },
    {
      detail: "A runner becomes part of the route memory.",
      id: "urban-runner",
      kind: "friend",
      progress: 0.5,
      title: "Morning runner",
    },
    {
      detail: "A near-overlap reveals how the loop reconnects.",
      id: "urban-overlap",
      kind: "question",
      progress: 0.77,
      title: "Loop overlap",
    },
  ]),
  makeRoute(mountainRide, "mountain-ride", [
    {
      detail: "A fast branch leaves the bike loop near its first quarter.",
      id: "ride-branch",
      kind: "question",
      progress: 0.2,
      title: "Distant branch",
    },
    {
      detail: "A cyclist is added to this route's memory.",
      id: "ride-cyclist",
      kind: "friend",
      progress: 0.48,
      title: "Passing cyclist",
    },
    {
      detail: "The return leg exposes a second trail connection.",
      id: "ride-return",
      kind: "question",
      progress: 0.75,
      title: "Return connection",
    },
  ]),
];

export const demoTrack = demoRoutes[0]!.track;
export const DEMO_SOURCE_URL = demoRoutes[0]!.sourceUrl;
