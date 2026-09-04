import { Platform } from "react-native";
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";

import type { TrackPoint } from "../core/types";
import { appendBackgroundPoints } from "./storage";

export const LOCATION_TASK_NAME = "mappie-background-location-v1";

export function pointFromLocation(
  location: Location.LocationObject,
): TrackPoint {
  return {
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
    timestamp: location.timestamp,
    accuracy: location.coords.accuracy ?? undefined,
    elevation: location.coords.altitude ?? undefined,
  };
}

if (Platform.OS !== "web" && !TaskManager.isTaskDefined(LOCATION_TASK_NAME)) {
  TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
    if (error || !data) return;
    const payload = data as { locations?: Location.LocationObject[] };
    if (!payload.locations?.length) return;
    await appendBackgroundPoints(payload.locations.map(pointFromLocation));
  });
}

export async function isBackgroundRecording(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  return Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
}

export async function startBackgroundRecording(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  const available = await TaskManager.isAvailableAsync();
  if (!available) return false;

  const permission = await Location.requestBackgroundPermissionsAsync();
  if (permission.status !== Location.PermissionStatus.GRANTED) return false;
  if (await isBackgroundRecording()) return true;

  await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
    accuracy: Location.Accuracy.High,
    activityType: Location.ActivityType.Fitness,
    distanceInterval: 3,
    deferredUpdatesDistance: 20,
    deferredUpdatesInterval: 15_000,
    pausesUpdatesAutomatically: false,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: "Mappie is charting",
      notificationBody:
        "Your current exploration is being recorded on this device.",
      notificationColor: "#61F2B1",
    },
  });
  return true;
}

export async function stopBackgroundRecording(): Promise<void> {
  if (Platform.OS === "web") return;
  if (await isBackgroundRecording()) {
    await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
  }
}
