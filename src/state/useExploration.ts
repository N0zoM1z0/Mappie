import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Platform } from "react-native";
import * as Location from "expo-location";

import { filterTrackPoints } from "../core/geo";
import type { Track, TrackPoint } from "../core/types";
import {
  isBackgroundRecording,
  pointFromLocation,
  startBackgroundRecording,
  stopBackgroundRecording,
} from "../services/location";
import {
  clearActiveTrack,
  clearAllExplorationData,
  drainBackgroundPoints,
  getStorageStatus,
  loadActiveTrack,
  loadArchive,
  requestPersistentStorage,
  saveActiveTrack,
  saveArchive,
} from "../services/storage";
import {
  storageErrorMessage,
  type ExplorationStorageStatus,
} from "../services/storageTypes";

interface ExplorationState {
  activeTrack: Track | null;
  addTrack: (track: Track) => Promise<void>;
  clearTracks: () => Promise<void>;
  hydrated: boolean;
  message: string | null;
  protectStorage: () => Promise<void>;
  recording: boolean;
  restoreArchive: (tracks: Track[]) => Promise<void>;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<void>;
  storageStatus: ExplorationStorageStatus | null;
  tracks: Track[];
}

export function useExploration(): ExplorationState {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [activeTrack, setActiveTrack] = useState<Track | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [recording, setRecording] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [storageStatus, setStorageStatus] =
    useState<ExplorationStorageStatus | null>(null);
  const watchRef = useRef<Location.LocationSubscription | null>(null);
  const activeRef = useRef<Track | null>(null);
  const tracksRef = useRef<Track[]>([]);

  const refreshStorageStatus = useCallback(async () => {
    const status = await getStorageStatus();
    setStorageStatus(status);
    return status;
  }, []);

  const updateActive = useCallback(
    (updater: (current: Track | null) => Track | null) => {
      setActiveTrack((current) => {
        const next = updater(current);
        activeRef.current = next;
        if (next) {
          void saveActiveTrack(next).catch((error) =>
            setMessage(storageErrorMessage(error)),
          );
        }
        return next;
      });
    },
    [],
  );

  const mergeBufferedPoints = useCallback(async () => {
    const buffered = await drainBackgroundPoints();
    if (buffered.length === 0) return;
    updateActive((current) =>
      current
        ? { ...current, points: [...current.points, ...buffered] }
        : current,
    );
  }, [updateActive]);

  const commitTracks = useCallback(
    async (updater: (current: Track[]) => Track[]) => {
      const next = updater(tracksRef.current);
      await saveArchive(next);
      tracksRef.current = next;
      setTracks(next);
      void refreshStorageStatus().catch(() => undefined);
    },
    [refreshStorageStatus],
  );

  useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        const [storedTracks, storedActive, storedBackgroundActive] =
          await Promise.all([
            loadArchive(),
            loadActiveTrack(),
            isBackgroundRecording().catch(() => false),
          ]);
        if (!mounted) return;

        let nextTracks = storedTracks;
        let nextActive = storedActive;
        let backgroundActive = storedBackgroundActive;
        if (backgroundActive && !storedActive) {
          await stopBackgroundRecording().catch(() => undefined);
          backgroundActive = false;
        }
        if (storedActive && !backgroundActive) {
          const recovered = filterTrackPoints(storedActive.points);
          if (recovered.accepted.length >= 2) {
            nextTracks = [
              ...storedTracks,
              {
                ...storedActive,
                name: `${storedActive.name} (Recovered)`,
                points: recovered.accepted,
              },
            ];
            await saveArchive(nextTracks);
            setMessage(
              `Recovered ${recovered.accepted.length} fixes from an interrupted session.`,
            );
          }
          nextActive = null;
          await clearActiveTrack();
        }

        tracksRef.current = nextTracks;
        setTracks(nextTracks);
        setActiveTrack(nextActive);
        activeRef.current = nextActive;
        setRecording(backgroundActive);
        await mergeBufferedPoints();
        await refreshStorageStatus();
      } catch (error) {
        if (mounted) setMessage(storageErrorMessage(error));
      } finally {
        if (mounted) setHydrated(true);
      }
    })();
    return () => {
      mounted = false;
      watchRef.current?.remove();
    };
  }, [mergeBufferedPoints, refreshStorageStatus]);

  useEffect(() => {
    if (!recording) return;
    const timer = setInterval(() => void mergeBufferedPoints(), 4_000);
    return () => clearInterval(timer);
  }, [mergeBufferedPoints, recording]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void mergeBufferedPoints();
    });
    return () => subscription.remove();
  }, [mergeBufferedPoints]);

  const addTrack = useCallback(
    async (track: Track) => {
      const report = filterTrackPoints(track.points);
      if (report.accepted.length < 2)
        throw new Error("The route has fewer than two usable GPS points.");
      const cleanTrack = { ...track, points: report.accepted };
      await commitTracks((current) => [...current, cleanTrack]);
      const rejected = track.points.length - report.accepted.length;
      setMessage(
        rejected > 0
          ? `Imported ${report.accepted.length} fixes; filtered ${rejected}.`
          : `Imported ${report.accepted.length} fixes.`,
      );
    },
    [commitTracks],
  );

  const startRecording = useCallback(async () => {
    if (recording) return;
    setMessage(null);
    const foreground = await Location.requestForegroundPermissionsAsync();
    if (foreground.status !== Location.PermissionStatus.GRANTED) {
      setMessage("Location permission was not granted.");
      return;
    }

    const now = Date.now();
    const nextTrack: Track = {
      id: `live-${now}`,
      name: `Exploration ${new Date(now).toLocaleDateString()}`,
      source: "live",
      createdAt: now,
      points: [],
    };
    updateActive(() => nextTrack);

    let backgroundEnabled = false;
    try {
      backgroundEnabled = await startBackgroundRecording();
    } catch {
      backgroundEnabled = false;
    }

    watchRef.current?.remove();
    try {
      watchRef.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          distanceInterval: 3,
          timeInterval: 3_000,
        },
        (location) => {
          const point = pointFromLocation(location);
          updateActive((current) =>
            current
              ? { ...current, points: [...current.points, point] }
              : current,
          );
        },
      );
    } catch (error) {
      if (!backgroundEnabled) {
        activeRef.current = null;
        setActiveTrack(null);
        await clearActiveTrack();
        throw error;
      }
    }
    setRecording(true);
    setMessage(
      backgroundEnabled
        ? "Exploration recording started in the background."
        : Platform.OS === "web"
          ? "Exploration recording started while this tab remains active."
          : "Exploration recording started in the foreground.",
    );
  }, [recording, updateActive]);

  const stopRecording = useCallback(async () => {
    watchRef.current?.remove();
    watchRef.current = null;
    await stopBackgroundRecording().catch(() => undefined);
    try {
      const buffered = await drainBackgroundPoints();
      const current = activeRef.current;
      const report = current
        ? filterTrackPoints([...current.points, ...buffered])
        : null;
      if (current && report && report.accepted.length >= 2) {
        const finished = { ...current, points: report.accepted };
        await commitTracks((stored) => [...stored, finished]);
        setMessage(`Saved ${report.accepted.length} location fixes.`);
      } else {
        setMessage("Recording stopped before a usable path was captured.");
      }
      activeRef.current = null;
      setActiveTrack(null);
      await clearActiveTrack();
    } catch (error) {
      setMessage(storageErrorMessage(error));
      throw error;
    } finally {
      setRecording(false);
    }
  }, [commitTracks]);

  const restoreArchive = useCallback(
    async (restoredTracks: Track[]) => {
      await saveArchive(restoredTracks);
      tracksRef.current = restoredTracks;
      setTracks(restoredTracks);
      activeRef.current = null;
      setActiveTrack(null);
      await clearActiveTrack();
      await refreshStorageStatus();
      setMessage(
        `Restored ${restoredTracks.length} exploration ${restoredTracks.length === 1 ? "session" : "sessions"}.`,
      );
    },
    [refreshStorageStatus],
  );

  const protectStorage = useCallback(async () => {
    try {
      const status = await requestPersistentStorage();
      setStorageStatus(status);
      setMessage(
        status.persisted
          ? "Browser storage protection is active."
          : "Storage remains best effort; keep regular archive backups.",
      );
    } catch (error) {
      setMessage(storageErrorMessage(error));
      throw error;
    }
  }, []);

  const clearTracks = useCallback(async () => {
    watchRef.current?.remove();
    watchRef.current = null;
    await stopBackgroundRecording();
    await clearAllExplorationData();
    activeRef.current = null;
    tracksRef.current = [];
    setActiveTrack(null);
    setTracks([]);
    setRecording(false);
    await refreshStorageStatus();
    setMessage("Local exploration data cleared.");
  }, [refreshStorageStatus]);

  return {
    activeTrack,
    addTrack,
    clearTracks,
    hydrated,
    message,
    protectStorage,
    recording,
    restoreArchive,
    startRecording,
    stopRecording,
    storageStatus,
    tracks,
  };
}
