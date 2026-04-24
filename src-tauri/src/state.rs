//! Global application state (engine, device selection, etc.).

use std::collections::VecDeque;
use std::sync::{Arc, Mutex};

use crate::audio::capture::AudioCaptureSession;
use crate::ipc::types::FrameSubscribers;
use crate::ipc::types::MeterHistoryBuf;

pub struct AppState {
  pub capture: Mutex<Option<Box<dyn AudioCaptureSession>>>,
  pub meter_history: MeterHistoryBuf,
  /// `Some` while the native engine is running; used by `meter_add_frame_subscriber` / `meter_remove_frame_subscriber`.
  pub frame_subscribers: Mutex<Option<FrameSubscribers>>,
}

impl Default for AppState {
  fn default() -> Self {
    Self {
      capture: Mutex::new(None),
      meter_history: Arc::new(Mutex::new(VecDeque::new())),
      frame_subscribers: Mutex::new(None),
    }
  }
}
