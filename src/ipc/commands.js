/**
 * All `invoke` calls for the Rust backend. UI code must import from here, not `@tauri-apps/api` directly.
 */
import { Channel, invoke } from "@tauri-apps/api/core";

export async function listAudioDevices() {
  return invoke("list_audio_devices");
}

/** @param {{ deviceId: string; onPcmBytes: (bytes: Uint8Array) => void }} opts */
/** Tauri 2 Channel delivers `{ message, index }` (and `{ end: true }` when done), not a bare `Uint8Array`. */
function channelPayloadToUint8Array(msg) {
  if (msg && typeof msg === "object" && "end" in msg && msg.end) {
    return null;
  }
  const payload = msg && typeof msg === "object" && "message" in msg ? msg.message : msg;
  if (payload instanceof Uint8Array) return payload;
  if (payload instanceof ArrayBuffer) return new Uint8Array(payload);
  if (ArrayBuffer.isView(payload)) {
    return new Uint8Array(payload.buffer, payload.byteOffset, payload.byteLength);
  }
  if (Array.isArray(payload)) {
    return new Uint8Array(payload);
  }
  return null;
}

export async function startAudioCapture({ deviceId, onPcmBytes }) {
  const onPcm = new Channel();
  onPcm.onmessage = (msg) => {
    const bytes = channelPayloadToUint8Array(msg);
    if (bytes?.byteLength) onPcmBytes(bytes);
  };
  await invoke("audio_start", { deviceId, onPcm });
  return onPcm;
}

export function stopAudioCapture() {
  return invoke("audio_stop");
}
