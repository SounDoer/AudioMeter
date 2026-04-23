//! `#[tauri::command]` handlers (Phase 1: capture + PCM channel).

use tauri::State;

use crate::audio::device::DeviceInfo;
use crate::audio::session::{build_device_list, CaptureSession};
use crate::state::AppState;

#[tauri::command]
pub fn list_audio_devices() -> Result<Vec<DeviceInfo>, String> {
  build_device_list()
}

#[tauri::command]
pub fn audio_start(
  device_id: String,
  on_pcm: tauri::ipc::Channel<Vec<u8>>,
  state: State<'_, AppState>,
) -> Result<(), String> {
  let mut g = state
    .inner()
    .capture
    .lock()
    .map_err(|_| "state lock poisoned".to_string())?;
  *g = None;
  let session = CaptureSession::start(&device_id, on_pcm)?;
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
