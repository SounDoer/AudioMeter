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

/// One loudness-history sample (~10 Hz), same cadence as legacy `HIST_PUSH_MS` in the frontend.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LoudnessHistTick {
  pub lufs_momentary: f64,
  pub lufs_short_term: f64,
}

/// High-rate meter frame (~60 Hz) on Tauri Channel `audio-frame`.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AudioFramePayload {
  pub peak_db: Vec<f64>,
  pub peak_hold_db: Vec<f64>,
  pub true_peak_max_dbtp: f64,
  pub lufs_momentary: f64,
  pub lufs_short_term: f64,
  pub integrated: f64,
  pub lra: f64,
  pub true_peak_l: f64,
  pub true_peak_r: f64,
  pub sample_l_db: f64,
  pub sample_r_db: f64,
  pub correlation: f64,
  pub vectorscope_path: String,
  pub spectrum_path: String,
  pub spectrum_peak_path: String,
  pub spectrum_band_centers_hz: Vec<f64>,
  pub spectrum_smooth_db: Vec<f64>,
  pub timestamp_ms: u64,
  #[serde(skip_serializing_if = "Option::is_none")]
  pub loudness_hist_tick: Option<LoudnessHistTick>,
}

/// ~2 Hz broadcast on Event `loudness-slow`.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LoudnessSlowPayload {
  pub lufs_integrated: Option<f64>,
  pub lufs_m_max: f64,
  pub lufs_st_max: f64,
  pub lra: f64,
  #[serde(skip_serializing_if = "Option::is_none")]
  pub psr: Option<f64>,
  #[serde(skip_serializing_if = "Option::is_none")]
  pub plr: Option<f64>,
}
