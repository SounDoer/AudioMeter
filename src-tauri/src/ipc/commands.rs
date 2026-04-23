//! `#[tauri::command]` handlers (Phase 2: capture + DSP → Channel / Events).

use tauri::{AppHandle, Emitter, State};

use crate::audio::capture::AudioCapture;
use crate::audio::cpal_backend;
use crate::audio::device::DeviceInfo;
use crate::audio::CpalBackend;
use crate::ipc::types::{AudioFramePayload, EngineStateChanged, MeterHistoryEntry};
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
  let session = CpalBackend.start_session(&device_id, on_frame, app.clone(), mh)?;
  {
    let mut g = state
      .inner()
      .capture
      .lock()
      .map_err(|_| "state lock poisoned".to_string())?;
    *g = Some(session);
  }
  if let Ok((sr, _ch)) = cpal_backend::device_default_format(&device_id) {
    let _ = app.emit("sample-rate-changed", sr);
  }
  let _ = app.emit(
    "engine-state-changed",
    EngineStateChanged {
      state: "running".into(),
      error: None,
    },
  );
  Ok(())
}

#[tauri::command]
pub fn audio_stop(app: AppHandle, state: State<'_, AppState>) -> Result<(), String> {
  let mut g = state
    .inner()
    .capture
    .lock()
    .map_err(|_| "state lock poisoned".to_string())?;
  *g = None;
  let _ = app.emit(
    "engine-state-changed",
    EngineStateChanged {
      state: "stopped".into(),
      error: None,
    },
  );
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
