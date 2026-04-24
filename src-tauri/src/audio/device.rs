//! Device enumeration metadata shared with the frontend.

use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct DeviceInfo {
  /// Stable `lb-*` / `cap-*` id (hash of name + format); legacy `out:N` / `in:N` still accepted by the backend.
  pub id: String,
  pub label: String,
  /// WASAPI loopback on a **render** endpoint (`out:*`). True when this row is real system-playback monitoring.
  pub is_system_output_monitor: bool,
  /// Legacy: name-based heuristic (Stereo Mix, “loopback” in name, etc.) on **capture** endpoints.
  pub is_loopback: bool,
  pub default_sample_rate: u32,
  pub channels: u16,
}
