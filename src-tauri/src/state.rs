//! Global application state (engine, device selection, etc.).

use std::collections::VecDeque;
use std::sync::{Arc, Mutex};

use crate::audio::session::CaptureSession;
use crate::ipc::types::MeterHistoryBuf;

pub struct AppState {
  pub capture: Mutex<Option<CaptureSession>>,
  pub meter_history: MeterHistoryBuf,
}

impl Default for AppState {
  fn default() -> Self {
    Self {
      capture: Mutex::new(None),
      meter_history: Arc::new(Mutex::new(VecDeque::new())),
    }
  }
}
