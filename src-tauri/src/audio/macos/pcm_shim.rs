//! C ABI entry for `tap_bridge.m` IOProc → Rust `SyncSender` (real-time thread).

use std::ffi::c_void;
use std::sync::atomic::AtomicU64;
use std::sync::mpsc::SyncSender;

use super::super::cpal_backend::{
  copy_f32_pcm_to_pooled_buffer, send_pcm_buffer_or_count_drop, PcmBufferPool,
};

/// Shared with Core Audio callback via raw pointer (`macos_tap_create`).
pub struct PcmBridgeCtx {
  pub tx: SyncSender<Vec<f32>>,
  pub dropped: std::sync::Arc<AtomicU64>,
  pub pool: PcmBufferPool,
}

#[no_mangle]
pub unsafe extern "C" fn pcm_bridge(
  userdata: *mut c_void,
  samples: *const f32,
  frame_count: u32,
  channels: u32,
) {
  if userdata.is_null() || samples.is_null() || channels == 0 {
    return;
  }
  let ctx = &*(userdata.cast::<PcmBridgeCtx>());
  let n = (frame_count as usize).saturating_mul(channels as usize);
  let slice = std::slice::from_raw_parts(samples, n);
  if let Some(buffer) = copy_f32_pcm_to_pooled_buffer(&ctx.pool, slice, &ctx.dropped) {
    send_pcm_buffer_or_count_drop(&ctx.tx, &ctx.pool, buffer, &ctx.dropped);
  }
}
