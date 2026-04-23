/**
 * All `invoke` calls for the Rust backend. UI code must import from here, not `@tauri-apps/api` directly.
 */
import { Channel, invoke } from "@tauri-apps/api/core";

export async function listAudioDevices() {
  return invoke("list_audio_devices");
}

/** @param {{ deviceId: string; onFrame: (payload: object) => void }} opts */
export async function startAudioCapture({ deviceId, onFrame }) {
  const onAudio = new Channel();
  onAudio.onmessage = (msg) => {
    const p = msg && typeof msg === "object" && "message" in msg ? msg.message : msg;
    if (p && typeof p === "object") onFrame(p);
  };
  await invoke("audio_start", { deviceId, onFrame: onAudio });
  return onAudio;
}

export function stopAudioCapture() {
  return invoke("audio_stop");
}
