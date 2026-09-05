import { memo, useEffect, useMemo, useRef, useState } from "react";
import {
  PanResponder,
  type GestureResponderEvent,
  type LayoutChangeEvent,
  type PanResponderGestureState,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Svg, { Circle, G, Line, Path, Rect } from "react-native-svg";

import { splitTrackAtGaps } from "../core/geo";
import {
  fitTrackViewport,
  pointsToPath,
  projectTracksToViewport,
} from "../core/projection";
import type { Track } from "../core/types";
import { colors } from "../theme";

export type MapLineTone = "confirmed" | "current" | "new" | "observed" | "raw";

const DRAW_ORDER: MapLineTone[] = [
  "raw",
  "observed",
  "confirmed",
  "new",
  "current",
];

interface MapCanvasProps {
  fitTracks?: Track[];
  lineTones?: Record<string, MapLineTone>;
  resetKey: number;
  showNodes?: boolean;
  showPosition?: boolean;
  tracks: Track[];
  zoomCommand: { id: number; direction: "in" | "out" };
}

interface Transform {
  scale: number;
  x: number;
  y: number;
}

function touchDistance(event: GestureResponderEvent): number | null {
  const [first, second] = event.nativeEvent.touches;
  if (!first || !second) return null;
  return Math.hypot(second.pageX - first.pageX, second.pageY - first.pageY);
}

export const MapCanvas = memo(function MapCanvas({
  fitTracks,
  lineTones = {},
  resetKey,
  showNodes = false,
  showPosition = false,
  tracks,
  zoomCommand,
}: MapCanvasProps) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [transform, setTransform] = useState<Transform>({
    scale: 1,
    x: 0,
    y: 0,
  });
  const gestureStart = useRef({
    transform: { scale: 1, x: 0, y: 0 },
    pinchDistance: 0,
  });
  const transformRef = useRef<Transform>(transform);

  const resetTransform = () => {
    const next = { scale: 1, x: 0, y: 0 };
    transformRef.current = next;
    setTransform(next);
  };

  useEffect(() => {
    resetTransform();
  }, [resetKey]);

  useEffect(() => {
    if (zoomCommand.id === 0) return;
    setTransform((current) => {
      const next = {
        ...current,
        scale: Math.min(
          6,
          Math.max(
            0.65,
            current.scale * (zoomCommand.direction === "in" ? 1.35 : 0.74),
          ),
        ),
      };
      transformRef.current = next;
      return next;
    });
  }, [zoomCommand]);

  const segmentedTracks = useMemo(
    () =>
      tracks.flatMap((track) =>
        splitTrackAtGaps(track.points).map((points, index) => ({
          ...track,
          id: `${track.id}-${index}`,
          points,
        })),
      ),
    [tracks],
  );
  const projectionFitTracks = fitTracks ?? tracks;
  const segmentedFitTracks = useMemo(
    () =>
      projectionFitTracks.flatMap((track) =>
        splitTrackAtGaps(track.points).map((points, index) => ({
          ...track,
          id: `${track.id}-fit-${index}`,
          points,
        })),
      ),
    [projectionFitTracks],
  );
  const viewport = useMemo(
    () =>
      fitTrackViewport(
        segmentedFitTracks,
        size.width,
        size.height,
        Math.min(52, size.width * 0.14),
      ),
    [segmentedFitTracks, size.height, size.width],
  );
  const projection = useMemo(
    () => projectTracksToViewport(segmentedTracks, viewport),
    [segmentedTracks, viewport],
  );
  const projectedTracks = projection.tracks;
  const pathLayers = useMemo(() => {
    const paths = new Map<MapLineTone, string[]>();
    for (const track of projectedTracks) {
      if (track.points.length < 2) continue;
      const originalId = track.id.replace(/-\d+$/, "");
      const tone = lineTones[originalId] ?? "confirmed";
      const tonePaths = paths.get(tone) ?? [];
      tonePaths.push(pointsToPath(track.points));
      paths.set(tone, tonePaths);
    }
    return DRAW_ORDER.flatMap((tone) => {
      const tonePaths = paths.get(tone);
      return tonePaths ? [{ d: tonePaths.join(" "), tone }] : [];
    });
  }, [lineTones, projectedTracks]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) =>
          Math.abs(gesture.dx) + Math.abs(gesture.dy) > 3,
        onPanResponderGrant: (event) => {
          gestureStart.current = {
            transform: transformRef.current,
            pinchDistance: touchDistance(event) ?? 0,
          };
        },
        onPanResponderMove: (event, gesture: PanResponderGestureState) => {
          const distance = touchDistance(event);
          if (distance && gestureStart.current.pinchDistance > 0) {
            const nextScale = Math.min(
              6,
              Math.max(
                0.65,
                gestureStart.current.transform.scale *
                  (distance / gestureStart.current.pinchDistance),
              ),
            );
            setTransform((current) => {
              const next = { ...current, scale: nextScale };
              transformRef.current = next;
              return next;
            });
            return;
          }
          const next = {
            ...gestureStart.current.transform,
            x: gestureStart.current.transform.x + gesture.dx,
            y: gestureStart.current.transform.y + gesture.dy,
          };
          transformRef.current = next;
          setTransform(next);
        },
      }),
    [],
  );

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setSize({ width, height });
  };
  const gridX = Array.from(
    { length: Math.ceil(size.width / 44) + 1 },
    (_, index) => index * 44,
  );
  const gridY = Array.from(
    { length: Math.ceil(size.height / 44) + 1 },
    (_, index) => index * 44,
  );
  const finalPoint = projectedTracks.at(-1)?.points.at(-1);

  return (
    <View
      onLayout={onLayout}
      style={styles.canvas}
      {...panResponder.panHandlers}
    >
      {size.width > 0 && size.height > 0 ? (
        <Svg height={size.height} width={size.width}>
          <Rect
            fill={colors.ink}
            height={size.height}
            width={size.width}
            x={0}
            y={0}
          />
          {gridX.map((x) => (
            <Line
              key={`x-${x}`}
              stroke={colors.grid}
              strokeWidth={1}
              x1={x}
              x2={x}
              y1={0}
              y2={size.height}
            />
          ))}
          {gridY.map((y) => (
            <Line
              key={`y-${y}`}
              stroke={colors.grid}
              strokeWidth={1}
              x1={0}
              x2={size.width}
              y1={y}
              y2={y}
            />
          ))}
          <Line
            stroke={colors.gridStrong}
            strokeWidth={1}
            x1={size.width / 2 - 8}
            x2={size.width / 2 + 8}
            y1={size.height / 2}
            y2={size.height / 2}
          />
          <Line
            stroke={colors.gridStrong}
            strokeWidth={1}
            x1={size.width / 2}
            x2={size.width / 2}
            y1={size.height / 2 - 8}
            y2={size.height / 2 + 8}
          />
          <G
            transform={`translate(${transform.x} ${transform.y}) scale(${transform.scale})`}
          >
            {pathLayers.map(({ d, tone }) => {
              const stroke =
                tone === "new"
                  ? colors.warning
                  : tone === "current"
                    ? colors.signal
                    : tone === "raw"
                      ? colors.raw
                      : tone === "observed"
                        ? colors.observed
                        : colors.accent;
              const strokeWidth =
                tone === "raw"
                  ? 1.4
                  : tone === "current"
                    ? 2.2
                    : tone === "new"
                      ? 3.6
                      : 2.8;
              const opacity =
                tone === "raw" ? 0.34 : tone === "observed" ? 0.66 : 1;
              return (
                <G key={tone}>
                  {tone === "new" || tone === "current" ? (
                    <Path
                      d={d}
                      fill="none"
                      opacity={tone === "current" ? 0.1 : 0.18}
                      stroke={stroke}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={(strokeWidth + 6) / transform.scale}
                    />
                  ) : null}
                  <Path
                    d={d}
                    fill="none"
                    opacity={opacity}
                    stroke={stroke}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={strokeWidth / transform.scale}
                  />
                </G>
              );
            })}
            {showNodes
              ? projectedTracks.flatMap((track) =>
                  track.points
                    .filter((_, index) => index % 5 === 0)
                    .map((point, index) => (
                      <Circle
                        cx={point.x}
                        cy={point.y}
                        fill={colors.ink}
                        key={`${track.id}-node-${index}`}
                        r={2.6 / transform.scale}
                        stroke={colors.accent}
                        strokeWidth={1.5 / transform.scale}
                      />
                    )),
                )
              : null}
            {showPosition && finalPoint ? (
              <>
                <Circle
                  cx={finalPoint.x}
                  cy={finalPoint.y}
                  fill="none"
                  opacity={0.45}
                  r={12 / transform.scale}
                  stroke={colors.accent}
                  strokeWidth={1 / transform.scale}
                />
                <Circle
                  cx={finalPoint.x}
                  cy={finalPoint.y}
                  fill={colors.accent}
                  r={5 / transform.scale}
                />
              </>
            ) : null}
          </G>
        </Svg>
      ) : null}
      {tracks.every((track) => track.points.length === 0) ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>UNWRITTEN TERRITORY</Text>
          <Text style={styles.emptyCode}>NO OBSERVED EDGES</Text>
        </View>
      ) : null}
      <View style={styles.scaleReadout}>
        <View style={styles.scaleBar} />
        <Text style={styles.scaleText}>
          {Math.max(
            1,
            Math.round((projection.metersPerPixel * 60) / transform.scale),
          )}{" "}
          M
        </Text>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  canvas: {
    backgroundColor: colors.ink,
    flex: 1,
    minHeight: 260,
    overflow: "hidden",
  },
  emptyCode: {
    color: colors.muted,
    fontFamily: "monospace",
    fontSize: 10,
    marginTop: 6,
  },
  emptyState: {
    alignItems: "center",
    bottom: 0,
    justifyContent: "center",
    left: 0,
    pointerEvents: "none",
    position: "absolute",
    right: 0,
    top: 0,
  },
  emptyTitle: {
    color: colors.text,
    fontFamily: "monospace",
    fontSize: 14,
    fontWeight: "700",
  },
  scaleBar: {
    backgroundColor: colors.muted,
    height: 1,
    width: 60,
  },
  scaleReadout: {
    alignItems: "flex-end",
    bottom: 14,
    pointerEvents: "none",
    position: "absolute",
    right: 14,
  },
  scaleText: {
    color: colors.muted,
    fontFamily: "monospace",
    fontSize: 9,
    marginTop: 4,
  },
});
