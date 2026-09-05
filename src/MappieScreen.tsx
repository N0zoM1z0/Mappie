import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { File as ExpoFile } from "expo-file-system";
import {
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  CircleStop,
  Crosshair,
  LocateFixed,
  Pause,
  Play,
  Radio,
  RotateCcw,
  Trash2,
  Upload,
  ZoomIn,
  ZoomOut,
} from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { IconButton } from "./components/IconButton";
import { MapCanvas, type MapMarker } from "./components/MapCanvas";
import { haversineDistance, trackDistance } from "./core/geo";
import { parseGPX } from "./core/gpx";
import type { Track } from "./core/types";
import { demoRoutes } from "./data/demoTrack";
import { useExploration } from "./state/useExploration";
import { colors } from "./theme";

type ViewMode = "demo" | "mine";

function formatDistance(meters: number): string {
  if (meters < 1_000) return `${Math.round(meters)} M`;
  return `${(meters / 1_000).toFixed(meters < 10_000 ? 2 : 1)} KM`;
}

function readout(
  value: number | undefined,
  positive: string,
  negative: string,
): string {
  if (value === undefined) return "--";
  return `${Math.abs(value).toFixed(5)} ${value >= 0 ? positive : negative}`;
}

function bearingBetween(
  from: { latitude: number; longitude: number } | undefined,
  to: { latitude: number; longitude: number } | undefined,
): number {
  if (!from || !to) return 0;
  const latitude1 = (from.latitude * Math.PI) / 180;
  const latitude2 = (to.latitude * Math.PI) / 180;
  const longitudeDelta = ((to.longitude - from.longitude) * Math.PI) / 180;
  const y = Math.sin(longitudeDelta) * Math.cos(latitude2);
  const x =
    Math.cos(latitude1) * Math.sin(latitude2) -
    Math.sin(latitude1) * Math.cos(latitude2) * Math.cos(longitudeDelta);
  return (Math.atan2(y, x) * 180) / Math.PI;
}

export function MappieScreen() {
  const { width } = useWindowDimensions();
  const compact = width < 560;
  const {
    activeTrack,
    addTrack,
    clearTracks,
    hydrated,
    message,
    recording,
    startRecording,
    stopRecording,
    tracks,
  } = useExploration();
  const [mode, setMode] = useState<ViewMode>("demo");
  const [routeIndex, setRouteIndex] = useState(0);
  const [replayProgress, setReplayProgress] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [resolvedDiscoveries, setResolvedDiscoveries] = useState<string[]>([]);
  const [triggeredDiscoveries, setTriggeredDiscoveries] = useState<string[]>(
    [],
  );
  const [demoNotice, setDemoNotice] = useState(
    "TARGET LOCKED / Explore the line before opening the objective.",
  );
  const [importing, setImporting] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const [zoomCommand, setZoomCommand] = useState<{
    id: number;
    direction: "in" | "out";
  }>({
    id: 0,
    direction: "in",
  });
  const demoRoute = demoRoutes[routeIndex]!;
  const demoTrack = demoRoute.track;

  useEffect(() => {
    if (!playing || mode !== "demo") return;
    const timer = setInterval(() => {
      setReplayProgress((current) => Math.min(1, current + 0.003));
    }, 32);
    return () => clearInterval(timer);
  }, [mode, playing]);

  useEffect(() => {
    if (mode !== "demo" || !playing) return;
    const discovery = demoRoute.discoveries.find(
      (candidate) =>
        replayProgress >= candidate.progress &&
        !triggeredDiscoveries.includes(candidate.id),
    );
    if (!discovery) return;
    setTriggeredDiscoveries((current) => [...current, discovery.id]);
    setDemoNotice(
      `${discovery.kind === "friend" ? "PERSON DETECTED" : "UNKNOWN SIGNAL"} / Open it or continue toward !`,
    );
    setPlaying(false);
  }, [demoRoute, mode, playing, replayProgress, triggeredDiscoveries]);

  useEffect(() => {
    if (replayProgress < 1) return;
    setPlaying(false);
    setDemoNotice(
      "TARGET REACHED / Route complete. Unopened signals remain optional.",
    );
  }, [replayProgress]);

  const replayTrack = useMemo<Track>(() => {
    const visibleCount = Math.max(
      1,
      Math.ceil(demoTrack.points.length * replayProgress),
    );
    return { ...demoTrack, points: demoTrack.points.slice(0, visibleCount) };
  }, [demoTrack, replayProgress]);
  const personalTracks = useMemo(
    () => [...tracks, ...(activeTrack ? [activeTrack] : [])],
    [activeTrack, tracks],
  );
  const displayedTracks = mode === "demo" ? [replayTrack] : personalTracks;
  const points = displayedTracks.flatMap((track) => track.points);
  const latestPoint = points.at(-1);
  const targetPoint = mode === "demo" ? demoTrack.points.at(-1) : undefined;
  const distance = displayedTracks.reduce(
    (total, track) => total + trackDistance(track.points),
    0,
  );
  const trackCount = displayedTracks.filter(
    (track) => track.points.length > 0,
  ).length;
  const routeMemoryCount = demoRoute.discoveries.filter((discovery) =>
    resolvedDiscoveries.includes(discovery.id),
  ).length;
  const targetDistance =
    latestPoint && targetPoint
      ? haversineDistance(latestPoint, targetPoint)
      : 0;
  const targetBearing = bearingBetween(latestPoint, targetPoint);
  const demoMarkers = useMemo<MapMarker[]>(() => {
    const goal = demoTrack.points.at(-1);
    const markers: MapMarker[] = goal
      ? [
          {
            accessibilityLabel: "Open route target",
            id: "route-goal",
            point: goal,
            variant: "goal",
          },
        ]
      : [];
    for (const discovery of demoRoute.discoveries) {
      if (replayProgress < discovery.progress) continue;
      const index = Math.round(
        discovery.progress * (demoTrack.points.length - 1),
      );
      const point = demoTrack.points[index];
      if (!point) continue;
      markers.push({
        accessibilityLabel: `Open discovery: ${discovery.title}`,
        id: discovery.id,
        point,
        variant: resolvedDiscoveries.includes(discovery.id)
          ? "complete"
          : discovery.kind,
      });
    }
    return markers;
  }, [demoRoute, demoTrack, replayProgress, resolvedDiscoveries]);

  const restartReplay = () => {
    setMode("demo");
    setReplayProgress(0);
    setPlaying(true);
    setTriggeredDiscoveries((current) =>
      current.filter(
        (id) => !demoRoute.discoveries.some((discovery) => discovery.id === id),
      ),
    );
    setDemoNotice(
      "TARGET LOCKED / Explore the line before opening the objective.",
    );
    setResetKey((current) => current + 1);
  };

  const toggleReplay = () => {
    if (replayProgress >= 1) {
      setReplayProgress(0);
      setTriggeredDiscoveries((current) =>
        current.filter(
          (id) =>
            !demoRoute.discoveries.some((discovery) => discovery.id === id),
        ),
      );
    }
    setDemoNotice(
      replayProgress >= 1
        ? "TARGET LOCKED / A new replay has started."
        : playing
          ? "SCAN PAUSED / Inspect any revealed signals."
          : "SCAN ACTIVE / Moving toward the target.",
    );
    setPlaying((current) => !current || replayProgress >= 1);
  };

  const changeDemoRoute = (direction: -1 | 1) => {
    setMode("demo");
    setRouteIndex(
      (current) =>
        (current + direction + demoRoutes.length) % demoRoutes.length,
    );
    setReplayProgress(0);
    setPlaying(true);
    setDemoNotice("TARGET LOCKED / New public trace loaded.");
    setResetKey((current) => current + 1);
  };

  const openDemoMarker = (id: string) => {
    if (id === "route-goal") {
      setDemoNotice(
        replayProgress >= 1
          ? "ROUTE COMPLETE / The ! target advances the main path."
          : `MAIN TARGET / ${formatDistance(targetDistance)} remain. Optional signals may be nearby.`,
      );
      return;
    }
    const discovery = demoRoute.discoveries.find(
      (candidate) => candidate.id === id,
    );
    if (!discovery) return;
    setResolvedDiscoveries((current) =>
      current.includes(id) ? current : [...current, id],
    );
    setDemoNotice(`MEMORY ADDED / ${discovery.title}: ${discovery.detail}`);
  };

  const importGPX = async () => {
    setImporting(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
        multiple: false,
        type: ["application/gpx+xml", "application/xml", "text/xml", "*/*"],
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      if (!asset) return;
      const xml = asset.file
        ? await asset.file.text()
        : await new ExpoFile(asset.uri).text();
      await addTrack(parseGPX(xml, asset.name.replace(/\.gpx$/i, "")));
      setMode("mine");
      setResetKey((current) => current + 1);
    } catch (error) {
      Alert.alert(
        "GPX import failed",
        error instanceof Error
          ? error.message
          : "The selected file could not be read.",
      );
    } finally {
      setImporting(false);
    }
  };

  const toggleRecording = async () => {
    setMode("mine");
    try {
      if (recording) await stopRecording();
      else await startRecording();
    } catch (error) {
      Alert.alert(
        "Location unavailable",
        error instanceof Error
          ? error.message
          : "Mappie could not start location updates.",
      );
    }
  };

  const confirmClear = () => {
    Alert.alert(
      "Clear personal map?",
      "This removes every locally stored exploration from this device.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: () => void clearTracks(),
        },
      ],
    );
  };

  const switchMode = (next: ViewMode) => {
    setMode(next);
    setResetKey((current) => current + 1);
  };

  return (
    <SafeAreaView edges={["top", "bottom"]} style={styles.safeArea}>
      <View style={[styles.header, compact && styles.headerCompact]}>
        <View style={styles.brand}>
          <View style={styles.brandMark}>
            <Crosshair color={colors.accent} size={22} strokeWidth={1.8} />
          </View>
          <View>
            <Text style={styles.brandName}>Mappie</Text>
            <Text style={styles.brandCode}>PERSONAL CARTOGRAPHY / 0.1</Text>
          </View>
        </View>
        <View accessibilityRole="tablist" style={styles.segmentedControl}>
          <ModeButton
            active={mode === "demo"}
            label="PUBLIC TRACE"
            onPress={() => switchMode("demo")}
          />
          <ModeButton
            active={mode === "mine"}
            label="MY MAP"
            onPress={() => switchMode("mine")}
          />
        </View>
      </View>

      <View style={styles.mapArea}>
        <MapCanvas
          fitTracks={mode === "demo" ? [demoTrack] : undefined}
          markers={mode === "demo" ? demoMarkers : undefined}
          onMarkerPress={mode === "demo" ? openDemoMarker : undefined}
          resetKey={resetKey}
          tracks={displayedTracks}
          zoomCommand={zoomCommand}
        />
        <View style={styles.mapHud}>
          <Text style={styles.hudLabel}>
            {mode === "demo"
              ? `(c) OPENSTREETMAP CONTRIBUTORS / ${demoRoute.activity} / ${String(routeIndex + 1).padStart(2, "0")} OF ${String(demoRoutes.length).padStart(2, "0")}`
              : recording
                ? "LIVE SURVEY"
                : "LOCAL ARCHIVE"}
          </Text>
          <Text numberOfLines={1} style={styles.hudTitle}>
            {mode === "demo"
              ? demoTrack.name
              : (activeTrack?.name ??
                tracks.at(-1)?.name ??
                "NO RECORDED SECTOR")}
          </Text>
        </View>
        {mode === "demo" ? (
          <View style={styles.targetCompass}>
            <View style={styles.compassDial}>
              <View style={{ transform: [{ rotate: `${targetBearing}deg` }] }}>
                <ArrowUp color={colors.warning} size={18} strokeWidth={2.5} />
              </View>
            </View>
            <View>
              <Text style={styles.compassLabel}>TARGET !</Text>
              <Text style={styles.compassValue}>
                {formatDistance(targetDistance)}
              </Text>
            </View>
          </View>
        ) : null}
        <View style={styles.mapTools}>
          <IconButton
            accessibilityLabel="Zoom in"
            icon={ZoomIn}
            onPress={() => setZoomCommand({ id: Date.now(), direction: "in" })}
          />
          <IconButton
            accessibilityLabel="Zoom out"
            icon={ZoomOut}
            onPress={() => setZoomCommand({ id: Date.now(), direction: "out" })}
          />
          <IconButton
            accessibilityLabel="Fit explored paths"
            icon={LocateFixed}
            onPress={() => setResetKey((current) => current + 1)}
          />
        </View>
        <View style={styles.coordinateHud}>
          <Text style={styles.coordinateText}>
            {readout(latestPoint?.latitude, "N", "S")}
          </Text>
          <Text style={styles.coordinateText}>
            {readout(latestPoint?.longitude, "E", "W")}
          </Text>
        </View>
        {mode === "demo" || message ? (
          <View style={styles.messageBand}>
            <Radio
              color={
                mode === "demo"
                  ? colors.warning
                  : recording
                    ? colors.warning
                    : colors.accent
              }
              size={14}
            />
            <Text numberOfLines={2} style={styles.messageText}>
              {mode === "demo" ? demoNotice : message}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.telemetry}>
        <Metric label="CHARTED" value={formatDistance(distance)} />
        <Metric label="FIXES" value={String(points.length).padStart(3, "0")} />
        <Metric
          label={mode === "demo" ? "MEMORY" : "SESSIONS"}
          value={
            mode === "demo"
              ? `${routeMemoryCount}/${demoRoute.discoveries.length}`
              : String(trackCount).padStart(2, "0")
          }
        />
        <Metric
          label="STATE"
          value={
            recording
              ? "LIVE"
              : mode === "demo"
                ? replayProgress >= 1
                  ? "CLEAR"
                  : playing
                    ? "SCAN"
                    : "FOUND"
                : "IDLE"
          }
          warning={recording}
        />
      </View>

      <View style={[styles.commandBar, compact && styles.commandBarCompact]}>
        {mode === "demo" ? (
          <View
            style={[styles.demoCommands, compact && styles.demoCommandsCompact]}
          >
            <View style={styles.routePicker}>
              <IconButton
                accessibilityLabel="Previous public trace"
                icon={ChevronLeft}
                onPress={() => changeDemoRoute(-1)}
              />
              <Pressable
                accessibilityLabel={`Open OpenStreetMap trace ${demoRoute.traceId}`}
                accessibilityRole="link"
                onPress={() => void Linking.openURL(demoRoute.sourceUrl)}
                style={({ pressed }) => [
                  styles.routeCopy,
                  pressed && styles.routeCopyPressed,
                ]}
              >
                <Text numberOfLines={1} style={styles.routeName}>
                  {String(routeIndex + 1).padStart(2, "0")} /{" "}
                  {String(demoRoutes.length).padStart(2, "0")}{" "}
                  {demoTrack.name.toUpperCase()}
                </Text>
                <Text numberOfLines={1} style={styles.sourceText}>
                  OSM TRACE {demoRoute.traceId} / {demoRoute.originalPointCount}{" "}
                  PUBLIC FIXES
                </Text>
              </Pressable>
              <IconButton
                accessibilityLabel="Next public trace"
                icon={ChevronRight}
                onPress={() => changeDemoRoute(1)}
              />
            </View>
            <View style={styles.playbackTools}>
              <IconButton
                accessibilityLabel={
                  playing
                    ? "Pause public trace replay"
                    : "Play public trace replay"
                }
                icon={playing ? Pause : Play}
                label={playing ? "PAUSE" : "CONTINUE"}
                onPress={toggleReplay}
                tone="primary"
              />
              <IconButton
                accessibilityLabel="Restart public trace replay"
                icon={RotateCcw}
                onPress={restartReplay}
              />
            </View>
          </View>
        ) : (
          <>
            <IconButton
              accessibilityLabel="Import a GPX route"
              disabled={importing || recording}
              icon={Upload}
              label={importing ? "READING" : "IMPORT GPX"}
              onPress={() => void importGPX()}
            />
            <IconButton
              accessibilityLabel={
                recording
                  ? "Stop and save exploration"
                  : "Start live exploration"
              }
              icon={recording ? CircleStop : Crosshair}
              label={recording ? "STOP" : "EXPLORE"}
              onPress={() => void toggleRecording()}
              tone="primary"
            />
            <IconButton
              accessibilityLabel="Clear local exploration data"
              disabled={personalTracks.length === 0 || recording}
              icon={Trash2}
              onPress={confirmClear}
              tone="danger"
            />
          </>
        )}
      </View>
      {!hydrated ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : null}
    </SafeAreaView>
  );
}

function ModeButton({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.modeButton,
        active && styles.modeButtonActive,
        pressed && styles.modeButtonPressed,
      ]}
    >
      <Text
        style={[styles.modeButtonText, active && styles.modeButtonTextActive]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function Metric({
  label,
  value,
  warning = false,
}: {
  label: string;
  value: string;
  warning?: boolean;
}) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text
        numberOfLines={1}
        style={[styles.metricValue, warning && styles.metricWarning]}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  brand: {
    alignItems: "center",
    flexDirection: "row",
    gap: 11,
  },
  brandCode: {
    color: colors.muted,
    fontFamily: "monospace",
    fontSize: 9,
  },
  brandMark: {
    alignItems: "center",
    borderColor: colors.accentMuted,
    borderRadius: 6,
    borderWidth: 1,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  brandName: {
    color: colors.text,
    fontSize: 25,
    fontWeight: "700",
  },
  commandBar: {
    alignItems: "center",
    backgroundColor: colors.panel,
    borderTopColor: colors.line,
    borderTopWidth: 1,
    flexDirection: "row",
    gap: 10,
    minHeight: 66,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  commandBarCompact: {
    flexWrap: "wrap",
    minHeight: 64,
  },
  compassDial: {
    alignItems: "center",
    borderColor: colors.warning,
    borderRadius: 18,
    borderWidth: 1,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  compassLabel: {
    color: colors.warning,
    fontFamily: "monospace",
    fontSize: 8,
    fontWeight: "700",
  },
  compassValue: {
    color: colors.text,
    fontFamily: "monospace",
    fontSize: 11,
    fontWeight: "700",
    marginTop: 2,
  },
  coordinateHud: {
    bottom: 12,
    left: 13,
    pointerEvents: "none",
    position: "absolute",
  },
  coordinateText: {
    color: colors.muted,
    fontFamily: "monospace",
    fontSize: 9,
    lineHeight: 14,
  },
  header: {
    alignItems: "center",
    backgroundColor: colors.panel,
    borderBottomColor: colors.line,
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 72,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  headerCompact: {
    alignItems: "stretch",
    flexDirection: "column",
    gap: 10,
  },
  demoCommands: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: 10,
  },
  demoCommandsCompact: {
    alignItems: "stretch",
    flexDirection: "column",
  },
  hudLabel: {
    color: colors.accent,
    fontFamily: "monospace",
    fontSize: 9,
    fontWeight: "700",
  },
  hudTitle: {
    color: colors.text,
    fontFamily: "monospace",
    fontSize: 12,
    marginTop: 3,
    maxWidth: 260,
  },
  loading: {
    alignItems: "center",
    backgroundColor: colors.ink,
    bottom: 0,
    justifyContent: "center",
    left: 0,
    opacity: 0.9,
    position: "absolute",
    right: 0,
    top: 0,
  },
  mapArea: {
    flex: 1,
    minHeight: 260,
    position: "relative",
  },
  mapHud: {
    left: 14,
    pointerEvents: "none",
    position: "absolute",
    top: 13,
  },
  mapTools: {
    gap: 7,
    position: "absolute",
    right: 12,
    top: 12,
  },
  messageBand: {
    alignItems: "center",
    backgroundColor: colors.panelRaised,
    borderColor: colors.line,
    borderRadius: 5,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    left: 14,
    maxWidth: 300,
    paddingHorizontal: 10,
    paddingVertical: 8,
    pointerEvents: "none",
    position: "absolute",
    top: 57,
  },
  messageText: {
    color: colors.text,
    flexShrink: 1,
    fontFamily: "monospace",
    fontSize: 10,
  },
  playbackTools: {
    flexDirection: "row",
    gap: 8,
  },
  metric: {
    borderRightColor: colors.line,
    borderRightWidth: 1,
    flex: 1,
    minWidth: 68,
    paddingHorizontal: 10,
  },
  metricLabel: {
    color: colors.muted,
    fontFamily: "monospace",
    fontSize: 8,
  },
  metricValue: {
    color: colors.text,
    fontFamily: "monospace",
    fontSize: 14,
    fontWeight: "700",
    marginTop: 3,
  },
  metricWarning: {
    color: colors.warning,
  },
  modeButton: {
    alignItems: "center",
    flex: 1,
    height: 34,
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  modeButtonActive: {
    backgroundColor: colors.accentMuted,
  },
  modeButtonPressed: {
    opacity: 0.7,
  },
  modeButtonText: {
    color: colors.muted,
    fontFamily: "monospace",
    fontSize: 10,
    fontWeight: "700",
  },
  modeButtonTextActive: {
    color: colors.accent,
  },
  safeArea: {
    backgroundColor: colors.panel,
    flex: 1,
  },
  routeCopy: {
    flex: 1,
    justifyContent: "center",
    minHeight: 44,
    minWidth: 0,
    paddingHorizontal: 2,
  },
  routeCopyPressed: {
    opacity: 0.65,
  },
  routeName: {
    color: colors.text,
    fontFamily: "monospace",
    fontSize: 10,
    fontWeight: "700",
  },
  routePicker: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: 8,
    minWidth: 0,
  },
  segmentedControl: {
    borderColor: colors.line,
    borderRadius: 5,
    borderWidth: 1,
    flexDirection: "row",
    minWidth: 240,
  },
  sourceText: {
    color: colors.muted,
    fontFamily: "monospace",
    fontSize: 8,
    lineHeight: 12,
    marginTop: 2,
  },
  targetCompass: {
    alignItems: "center",
    bottom: 42,
    flexDirection: "row",
    gap: 8,
    left: 13,
    pointerEvents: "none",
    position: "absolute",
  },
  telemetry: {
    backgroundColor: colors.panelRaised,
    borderTopColor: colors.line,
    borderTopWidth: 1,
    flexDirection: "row",
    minHeight: 59,
    paddingVertical: 10,
  },
});
