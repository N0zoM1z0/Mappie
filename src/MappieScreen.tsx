import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { File as ExpoFile } from "expo-file-system";
import {
  ChevronLeft,
  ChevronRight,
  CircleStop,
  Crosshair,
  GitMerge,
  LocateFixed,
  Pause,
  Play,
  RotateCcw,
  SkipBack,
  SkipForward,
  Trash2,
  Upload,
  ZoomIn,
  ZoomOut,
} from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { IconButton } from "./components/IconButton";
import { MapCanvas, type MapLineTone } from "./components/MapCanvas";
import { trackDistance } from "./core/geo";
import { parseGPX } from "./core/gpx";
import {
  reconstructMap,
  reconstructionTracks,
  type ReconstructionResult,
} from "./core/reconstruction";
import type { Track } from "./core/types";
import { DEMO_AREA_LABEL, demoSessions } from "./data/demoTrack";
import { useExploration } from "./state/useExploration";
import { colors } from "./theme";

type ViewMode = "demo" | "mine";
type MapLayer = "map" | "raw";

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

function edgeTones(
  reconstruction: ReconstructionResult,
  currentSession: number | undefined,
): Record<string, MapLineTone> {
  return Object.fromEntries(
    reconstruction.edges.map((edge) => [
      `edge-${edge.id}`,
      edge.firstSeenSession === currentSession
        ? "new"
        : edge.visitCount >= 2
          ? "confirmed"
          : "observed",
    ]),
  );
}

function rawTones(
  tracks: Track[],
  currentTrackId: string | undefined,
): Record<string, MapLineTone> {
  return Object.fromEntries(
    tracks.map((track) => [
      track.id,
      track.id === currentTrackId ? "current" : "raw",
    ]),
  );
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
  const [layer, setLayer] = useState<MapLayer>("map");
  const [sessionIndex, setSessionIndex] = useState(0);
  const [replayProgress, setReplayProgress] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [importing, setImporting] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const [zoomCommand, setZoomCommand] = useState<{
    id: number;
    direction: "in" | "out";
  }>({ id: 0, direction: "in" });

  const demoSession = demoSessions[sessionIndex]!;
  const replayFrameCount = sessionIndex < 10 ? 50 : sessionIndex < 30 ? 25 : 12;
  const replayFrame = Math.floor(replayProgress * replayFrameCount);
  const visibleDemoTracks = useMemo(() => {
    const previous = demoSessions
      .slice(0, sessionIndex)
      .map((session) => session.track);
    const visibleCount = Math.max(
      2,
      Math.ceil(
        demoSession.track.points.length * (replayFrame / replayFrameCount),
      ),
    );
    return [
      ...previous,
      {
        ...demoSession.track,
        points: demoSession.track.points.slice(0, visibleCount),
      },
    ];
  }, [demoSession, replayFrame, replayFrameCount, sessionIndex]);
  const allDemoTracks = useMemo(
    () => demoSessions.map((session) => session.track),
    [],
  );
  const personalTracks = useMemo(
    () => [...tracks, ...(activeTrack ? [activeTrack] : [])],
    [activeTrack, tracks],
  );
  const demoMap = useMemo(
    () => reconstructMap(visibleDemoTracks),
    [visibleDemoTracks],
  );
  const personalMap = useMemo(
    () => reconstructMap(personalTracks),
    [personalTracks],
  );
  const reconstruction = mode === "demo" ? demoMap : personalMap;
  const rawTracks = mode === "demo" ? visibleDemoTracks : personalTracks;
  const networkTracks = useMemo(
    () =>
      reconstructionTracks(
        reconstruction,
        mode === "demo" ? sessionIndex + 1 : personalTracks.length,
      ),
    [mode, personalTracks.length, reconstruction, sessionIndex],
  );
  const displayedTracks = layer === "map" ? networkTracks : rawTracks;
  const lineTones =
    layer === "map"
      ? edgeTones(reconstruction, mode === "demo" ? sessionIndex : undefined)
      : rawTones(rawTracks, rawTracks.at(-1)?.id);
  const currentContribution = reconstruction.sessions.at(-1);
  const contributionDistance =
    (currentContribution?.newDistanceMeters ?? 0) +
    (currentContribution?.revisitedDistanceMeters ?? 0);
  const revisitPercent =
    contributionDistance === 0
      ? 0
      : (100 * (currentContribution?.revisitedDistanceMeters ?? 0)) /
        contributionDistance;
  const latestPoint = rawTracks.at(-1)?.points.at(-1);
  const personalDistance = personalTracks.reduce(
    (sum, track) => sum + trackDistance(track.points),
    0,
  );

  useEffect(() => {
    if (!playing || mode !== "demo") return;
    const timer = setInterval(() => {
      setReplayProgress((current) => Math.min(1, current + 0.008));
    }, 32);
    return () => clearInterval(timer);
  }, [mode, playing]);

  useEffect(() => {
    if (replayProgress < 1) return;
    setPlaying(false);
  }, [replayProgress]);

  const changeSession = (direction: number) => {
    setMode("demo");
    setSessionIndex((current) =>
      Math.min(demoSessions.length - 1, Math.max(0, current + direction)),
    );
    setReplayProgress(0);
    setPlaying(true);
  };

  const restartScenario = () => {
    setMode("demo");
    setSessionIndex(0);
    setReplayProgress(0);
    setPlaying(true);
    setResetKey((current) => current + 1);
  };

  const toggleReplay = () => {
    if (replayProgress >= 1) setReplayProgress(0);
    setPlaying((current) => !current || replayProgress >= 1);
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

  const statusText =
    mode === "demo"
      ? `SESSION ${String(sessionIndex + 1).padStart(2, "0")} / ${formatDistance(currentContribution?.newDistanceMeters ?? 0)} NEW / ${formatDistance(currentContribution?.revisitedDistanceMeters ?? 0)} REVISITED`
      : message;

  return (
    <SafeAreaView edges={["top", "bottom"]} style={styles.safeArea}>
      <View style={[styles.header, compact && styles.headerCompact]}>
        <View style={styles.brand}>
          <View style={styles.brandMark}>
            <Crosshair color={colors.accent} size={22} strokeWidth={1.8} />
          </View>
          <View>
            <Text style={styles.brandName}>Mappie</Text>
            <Text style={styles.brandCode}>PERSONAL CARTOGRAPHY / 0.2</Text>
          </View>
        </View>
        <View accessibilityRole="tablist" style={styles.segmentedControl}>
          <ModeButton
            active={mode === "demo"}
            label="RECONSTRUCTION"
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
          fitTracks={mode === "demo" ? allDemoTracks : undefined}
          lineTones={lineTones}
          resetKey={resetKey}
          showPosition={mode === "mine" && recording}
          tracks={displayedTracks}
          zoomCommand={zoomCommand}
        />
        <View style={styles.mapHud}>
          <Text style={styles.hudLabel}>
            {mode === "demo"
              ? compact
                ? "(c) OSM CONTRIBUTORS / CAMBRIDGE"
                : `(c) OPENSTREETMAP CONTRIBUTORS / ${DEMO_AREA_LABEL}`
              : recording
                ? "LIVE SURVEY"
                : "LOCAL ARCHIVE"}
          </Text>
          <Text numberOfLines={1} style={styles.hudTitle}>
            {mode === "demo"
              ? demoSession.track.name.toUpperCase()
              : (activeTrack?.name ??
                tracks.at(-1)?.name ??
                "NO RECORDED SECTOR")}
          </Text>
        </View>
        <View accessibilityRole="tablist" style={styles.layerControl}>
          <LayerButton
            active={layer === "map"}
            label="MAP"
            onPress={() => setLayer("map")}
          />
          <LayerButton
            active={layer === "raw"}
            label="RAW"
            onPress={() => setLayer("raw")}
          />
        </View>
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
        {statusText ? (
          <View style={styles.messageBand}>
            <GitMerge
              color={recording ? colors.warning : colors.accent}
              size={14}
            />
            <Text numberOfLines={2} style={styles.messageText}>
              {statusText}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.telemetry}>
        <Metric
          label="SESSIONS"
          value={String(reconstruction.sessions.length).padStart(2, "0")}
        />
        <Metric label="EDGES" value={String(reconstruction.edges.length)} />
        <Metric
          label="NEW"
          value={formatDistance(currentContribution?.newDistanceMeters ?? 0)}
        />
        <Metric label="REVISIT" value={`${Math.round(revisitPercent)}%`} />
        <Metric
          label="CONF."
          value={`${Math.round(reconstruction.confidence * 100)}%`}
          warning={recording}
        />
      </View>

      <View style={[styles.commandBar, compact && styles.commandBarCompact]}>
        {mode === "demo" ? (
          <View
            style={[styles.demoCommands, compact && styles.demoCommandsCompact]}
          >
            <View style={styles.sessionPicker}>
              <IconButton
                accessibilityLabel="Previous exploration session"
                disabled={sessionIndex === 0}
                icon={ChevronLeft}
                onPress={() => changeSession(-1)}
              />
              <Pressable
                accessibilityLabel={`Open OpenStreetMap trace ${demoSession.traceId}`}
                accessibilityRole="link"
                onPress={() => void Linking.openURL(demoSession.sourceUrl)}
                style={({ pressed }) => [
                  styles.sessionCopy,
                  pressed && styles.sessionCopyPressed,
                ]}
              >
                <Text numberOfLines={1} style={styles.sessionName}>
                  SESSION {String(sessionIndex + 1).padStart(2, "0")} /{" "}
                  {String(demoSessions.length).padStart(2, "0")}{" "}
                  {demoSession.activity}
                </Text>
                <Text numberOfLines={1} style={styles.sourceText}>
                  OSM {demoSession.traceId} / {demoSession.areaPointCount} AREA
                  FIXES
                </Text>
              </Pressable>
              <IconButton
                accessibilityLabel="Next exploration session"
                disabled={sessionIndex === demoSessions.length - 1}
                icon={ChevronRight}
                onPress={() => changeSession(1)}
              />
            </View>
            <View style={styles.playbackTools}>
              <IconButton
                accessibilityLabel="Back ten exploration sessions"
                disabled={sessionIndex === 0}
                icon={SkipBack}
                onPress={() => changeSession(-10)}
              />
              <IconButton
                accessibilityLabel={
                  playing
                    ? "Pause exploration replay"
                    : "Play exploration replay"
                }
                icon={playing ? Pause : Play}
                label={playing ? "PAUSE" : "REPLAY"}
                onPress={toggleReplay}
                tone="primary"
              />
              <IconButton
                accessibilityLabel="Restart reconstruction scenario"
                icon={RotateCcw}
                onPress={restartScenario}
              />
              <IconButton
                accessibilityLabel="Forward ten exploration sessions"
                disabled={sessionIndex === demoSessions.length - 1}
                icon={SkipForward}
                onPress={() => changeSession(10)}
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
            <View style={styles.personalDistance}>
              <Text style={styles.sourceText}>RAW DISTANCE</Text>
              <Text style={styles.personalDistanceValue}>
                {formatDistance(personalDistance)}
              </Text>
            </View>
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
        numberOfLines={1}
        style={[styles.modeButtonText, active && styles.modeButtonTextActive]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function LayerButton({
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
      accessibilityLabel={`${label} layer${active ? " selected" : ""}`}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.layerButton,
        active && styles.layerButtonActive,
        pressed && styles.modeButtonPressed,
      ]}
    >
      <Text
        style={[styles.layerButtonText, active && styles.layerButtonTextActive]}
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
      <Text numberOfLines={1} style={styles.metricLabel}>
        {label}
      </Text>
      <Text
        adjustsFontSizeToFit
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
  layerButton: {
    alignItems: "center",
    flex: 1,
    height: 28,
    justifyContent: "center",
  },
  layerButtonActive: {
    backgroundColor: colors.accentMuted,
  },
  layerButtonText: {
    color: colors.muted,
    fontFamily: "monospace",
    fontSize: 9,
    fontWeight: "700",
  },
  layerButtonTextActive: {
    color: colors.accent,
  },
  layerControl: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 5,
    borderWidth: 1,
    flexDirection: "row",
    position: "absolute",
    right: 58,
    top: 13,
    width: 112,
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
    top: 49,
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
    maxWidth: 340,
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
  metric: {
    borderRightColor: colors.line,
    borderRightWidth: 1,
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 8,
  },
  metricLabel: {
    color: colors.muted,
    fontFamily: "monospace",
    fontSize: 8,
  },
  metricValue: {
    color: colors.text,
    fontFamily: "monospace",
    fontSize: 13,
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
    minWidth: 0,
    paddingHorizontal: 9,
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
  personalDistance: {
    marginLeft: "auto",
    minWidth: 80,
  },
  personalDistanceValue: {
    color: colors.text,
    fontFamily: "monospace",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 2,
  },
  playbackTools: {
    flexDirection: "row",
    gap: 8,
  },
  safeArea: {
    backgroundColor: colors.panel,
    flex: 1,
  },
  segmentedControl: {
    borderColor: colors.line,
    borderRadius: 5,
    borderWidth: 1,
    flexDirection: "row",
    minWidth: 250,
  },
  sessionCopy: {
    flex: 1,
    justifyContent: "center",
    minHeight: 44,
    minWidth: 0,
    paddingHorizontal: 2,
  },
  sessionCopyPressed: {
    opacity: 0.65,
  },
  sessionName: {
    color: colors.text,
    fontFamily: "monospace",
    fontSize: 10,
    fontWeight: "700",
  },
  sessionPicker: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: 8,
    minWidth: 0,
  },
  sourceText: {
    color: colors.muted,
    fontFamily: "monospace",
    fontSize: 8,
    lineHeight: 12,
    marginTop: 2,
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
