//! Device enumeration metadata shared with the frontend.

use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeviceInfo {
  pub id: String,
  pub label: String,
  pub is_loopback: bool,
}
