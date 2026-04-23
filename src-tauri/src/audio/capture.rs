//! `AudioCapture` abstraction over platform backends (see `docs/architecture.md` §5).

use super::device::DeviceInfo;

/// One PCM buffer from the device; channel count is never hard-coded to stereo.
#[derive(Clone, Debug)]
pub struct PcmFrame {
  pub samples: Vec<f32>,
  pub channels: u16,
  pub sample_rate: u32,
  pub timestamp_ns: u64,
}

/// Abstract capture backend (cpal today, Core Audio taps later).
pub trait AudioCapture: Send {
  fn list_devices(&self) -> Vec<DeviceInfo>;
}
