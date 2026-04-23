//! Device enumeration metadata shared with the frontend.

use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct DeviceInfo {
  pub id: String,
  pub label: String,
  /// WASAPI loopback on a **render** endpoint (`out:*`). True for real “系统输出在播什么”.
  pub is_system_output_monitor: bool,
  /// Legacy: name-based heuristic (Stereo Mix, “loopback” in name, etc.) on **capture** endpoints.
  pub is_loopback: bool,
  pub default_sample_rate: u32,
  pub channels: u16,
}
