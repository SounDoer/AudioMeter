//! cpal / WASAPI loopback implementation (Phase 1).

use super::capture::AudioCapture;
use super::device::DeviceInfo;

pub struct CpalBackend;

impl AudioCapture for CpalBackend {
  fn list_devices(&self) -> Vec<DeviceInfo> {
    vec![]
  }
}
