//! Global application state (engine, device selection, etc.).

use std::sync::Mutex;

use crate::audio::session::CaptureSession;

pub struct AppState {
  pub capture: Mutex<Option<CaptureSession>>,
}

impl Default for AppState {
  fn default() -> Self {
    Self {
      capture: Mutex::new(None),
    }
  }
}
