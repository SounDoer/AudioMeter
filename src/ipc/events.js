/**
 * Tauri `listen` helpers (slow loudness, device list).
 */
import { listen } from "@tauri-apps/api/event";

/**
 * @param {(payload: import("./types.js").LoudnessSlowPayload) => void} handler
 * @returns {Promise<() => void>}
 */
export async function onLoudnessSlow(handler) {
  return listen("loudness-slow", (e) => {
    handler(e.payload);
  });
}

/**
 * @param {(devices: { id: string; label: string }[]) => void} handler
 * @returns {Promise<() => void>}
 */
export async function onDeviceListChanged(handler) {
  return listen("device-list-changed", (e) => {
    handler(e.payload);
  });
}
