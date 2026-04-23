//! Payload shapes for Channel / Event streams (`docs/architecture.md` §7).

use serde::{Deserialize, Serialize};

#[allow(dead_code)]
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EngineStateChanged {
  pub state: String,
  #[serde(skip_serializing_if = "Option::is_none")]
  pub error: Option<String>,
}
