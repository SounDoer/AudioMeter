//! cpal / WASAPI loopback implementation (Phase 1).

use super::capture::AudioCapture;
use super::device::DeviceInfo;
use super::session::build_device_list;

pub struct CpalBackend;

impl AudioCapture for CpalBackend {
  fn list_devices(&self) -> Vec<DeviceInfo> {
    build_device_list().unwrap_or_default()
  }
}
