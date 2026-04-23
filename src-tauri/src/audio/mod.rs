//! System audio capture: device enumeration and PCM access (WASAPI loopback on Windows).

pub mod capture;
pub mod cpal_backend;
pub mod device;
pub mod session;

pub use capture::{AudioCapture, PcmFrame};
pub use cpal_backend::CpalBackend;
pub use device::DeviceInfo;
