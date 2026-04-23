//! `#[tauri::command]` handlers (Phase 2: capture + DSP → Channel / Events).

use tauri::{AppHandle, State};

use crate::audio::capture::AudioCapture;
use crate::audio::device::DeviceInfo;
use crate::audio::CpalBackend;
use crate::ipc::types::{AudioFramePayload, MeterHistoryEntry};
use crate::state::AppState;

#[tauri::command]
pub fn list_audio_devices() -> Result<Vec<DeviceInfo>, String> {
  CpalBackend.list_devices()
}

#[tauri::command]
pub fn audio_start(
  app: AppHandle,
  device_id: String,
  on_frame: tauri::ipc::Channel<AudioFramePayload>,
  state: State<'_, AppState>,
) -> Result<(), String> {
  {
    let mut g = state
      .inner()
      .capture
      .lock()
      .map_err(|_| "state lock poisoned".to_string())?;
    *g = None;
  }
  {
    let mut h = state
      .inner()
      .meter_history
      .lock()
      .map_err(|_| "meter history lock poisoned".to_string())?;
    h.clear();
  }
  let mh = state.inner().meter_history.clone();
  let session = CpalBackend.start_session(&device_id, on_frame, app, mh)?;
  {
    let mut g = state
      .inner()
      .capture
      .lock()
      .map_err(|_| "state lock poisoned".to_string())?;
    *g = Some(session);
  }
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

/// Clear meter history deque + DSP state on the capture thread (matches UI Clear for native path).
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

/// Full meter history ring (export / reconnect); same rows as `loudness_hist_tick` stream.
#[tauri::command]
pub fn get_meter_history(state: State<'_, AppState>) -> Result<Vec<MeterHistoryEntry>, String> {
  let g = state
    .inner()
    .meter_history
    .lock()
    .map_err(|_| "meter history lock poisoned".to_string())?;
  Ok(g.iter().cloned().collect())
}
