//! `#[tauri::command]` handlers (Phase 2: capture + DSP → Channel / Events).

use tauri::{AppHandle, State};

use crate::audio::device::DeviceInfo;
use crate::audio::session::{build_device_list, CaptureSession};
use crate::ipc::types::AudioFramePayload;
use crate::state::AppState;

#[tauri::command]
pub fn list_audio_devices() -> Result<Vec<DeviceInfo>, String> {
  build_device_list()
}

#[tauri::command]
pub fn audio_start(
  app: AppHandle,
  device_id: String,
  on_frame: tauri::ipc::Channel<AudioFramePayload>,
  state: State<'_, AppState>,
) -> Result<(), String> {
  let mut g = state
    .inner()
    .capture
    .lock()
    .map_err(|_| "state lock poisoned".to_string())?;
  *g = None;
  let session = CaptureSession::start(&device_id, on_frame, app)?;
  *g = Some(session);
  Ok(())
}

#[tauri::command]
pub fn audio_stop(state: State<'_, AppState>) -> Result<(), String> {
  let mut g = state
    .inner()
    .capture
    .lock()
    .map_err(|_| "state lock poisoned".to_string())?;
  *g = None;
  Ok(())
}

/// Clear loudness history ring + peak maxima on the capture thread (matches UI Clear for native path).
#[tauri::command]
pub fn clear_audio_history(state: State<'_, AppState>) -> Result<(), String> {
  let g = state
    .inner()
    .capture
    .lock()
    .map_err(|_| "state lock poisoned".to_string())?;
  if let Some(sess) = g.as_ref() {
    sess.request_clear_peak_history();
  }
  Ok(())
}
