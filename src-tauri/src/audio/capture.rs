//! `AudioCapture` abstraction over platform backends (see `docs/architecture.md` §5).
//!
//! Concrete **cpal / WASAPI** implementation lives in `cpal_backend.rs`; macOS may add another impl of the same traits.

use tauri::ipc::Channel;
use tauri::AppHandle;

use super::device::DeviceInfo;
use crate::ipc::types::{AudioFramePayload, MeterHistoryBuf};

/// One PCM buffer from the device; channel count is never hard-coded to stereo.
#[derive(Clone, Debug)]
pub struct PcmFrame {
  pub samples: Vec<f32>,
  pub channels: u16,
  pub sample_rate: u32,
  pub timestamp_ns: u64,
}

/// One active capture session; removing it from `AppState` and dropping it stops the stream.
pub trait AudioCaptureSession: Send {
  fn request_clear_peak_history(&self);
}

/// List devices + start capture (v1.0: `CpalBackend` only); returns a session as a trait object to avoid circular deps between `capture` and concrete backends.
pub trait AudioCapture: Send + Sync {
  fn list_devices(&self) -> Result<Vec<DeviceInfo>, String>;

  fn start_session(
    &self,
    device_id: &str,
    frame_tx: Channel<AudioFramePayload>,
    app: AppHandle,
    meter_history: MeterHistoryBuf,
  ) -> Result<Box<dyn AudioCaptureSession>, String>;
}
