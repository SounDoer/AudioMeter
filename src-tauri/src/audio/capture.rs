//! `AudioCapture` abstraction over platform backends (see `docs/architecture.md` §5).
//!
//! Concrete **cpal / WASAPI** implementation lives in `cpal_backend.rs`; macOS 可另增实现同一 trait。

use tauri::AppHandle;
use tauri::ipc::Channel;

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

/// 一次活跃采集；从 `AppState` 中移除并 drop 即停流。
pub trait AudioCaptureSession: Send {
  fn request_clear_peak_history(&self);
}

/// 设备枚举 + 启动采集（v1.0 仅 `CpalBackend`）；会话以 trait object 返回，避免 `capture` ↔ 具体后端循环依赖。
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
