//! Stable capture device ids (name + format + salt), distinct from legacy `out:N` / `in:N` index ids.

use sha2::{Digest, Sha256};
use std::collections::HashSet;

const LB_SALT: &[u8] = b"AudioMeter/v1/lb\0";
const CAP_SALT: &[u8] = b"AudioMeter/v1/cap\0";

fn digest_hex16(salt: &[u8], name: &str, channels: u16, sample_rate: u32, nonce: u32) -> String {
  let mut h = Sha256::new();
  h.update(salt);
  h.update(name.as_bytes());
  h.update([0]);
  h.update(channels.to_le_bytes());
  h.update(sample_rate.to_le_bytes());
  h.update(nonce.to_le_bytes());
  let full = h.finalize();
  let mut s = String::with_capacity(32);
  for b in full.iter().take(16) {
    s.push_str(&format!("{b:02x}"));
  }
  s
}

/// `lb-{32 hex}`; disambiguates rare hash collisions with `nonce` baked into the digest.
pub fn alloc_loopback_id(
  name: &str,
  channels: u16,
  sample_rate: u32,
  used: &mut HashSet<String>,
) -> String {
  let mut nonce = 0u32;
  loop {
    let body = digest_hex16(LB_SALT, name, channels, sample_rate, nonce);
    let id = format!("lb-{body}");
    if used.insert(id.clone()) {
      return id;
    }
    nonce = nonce.saturating_add(1);
    if nonce > 4096 {
      return format!("lb-fallback-{nonce}");
    }
  }
}

/// `cap-{32 hex}` for microphones / line-in / virtual cables.
pub fn alloc_capture_id(
  name: &str,
  channels: u16,
  sample_rate: u32,
  used: &mut HashSet<String>,
) -> String {
  let mut nonce = 0u32;
  loop {
    let body = digest_hex16(CAP_SALT, name, channels, sample_rate, nonce);
    let id = format!("cap-{body}");
    if used.insert(id.clone()) {
      return id;
    }
    nonce = nonce.saturating_add(1);
    if nonce > 4096 {
      return format!("cap-fallback-{nonce}");
    }
  }
}

pub fn is_stable_loopback_id(id: &str) -> bool {
  id.starts_with("lb-") && id.len() == 35 && id[3..].chars().all(|c| c.is_ascii_hexdigit())
}

pub fn is_stable_capture_id(id: &str) -> bool {
  id.starts_with("cap-") && id.len() == 36 && id[4..].chars().all(|c| c.is_ascii_hexdigit())
}

/// Legacy `out:123` — decimal index in cpal `output_devices()` enumeration order (unsorted).
pub fn parse_legacy_output_index(id: &str) -> Option<usize> {
  let rest = id.strip_prefix("out:")?;
  if rest.is_empty() || !rest.chars().all(|c| c.is_ascii_digit()) {
    return None;
  }
  rest.parse().ok()
}

/// Legacy `in:123` — decimal index in cpal `input_devices()` enumeration order (unsorted).
pub fn parse_legacy_input_index(id: &str) -> Option<usize> {
  let rest = id.strip_prefix("in:")?;
  if rest.is_empty() || !rest.chars().all(|c| c.is_ascii_digit()) {
    return None;
  }
  rest.parse().ok()
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn stable_loopback_id_reproducible_for_same_device_row() {
    let mut used_a = HashSet::new();
    let mut used_b = HashSet::new();
    let a = alloc_loopback_id("Speakers", 2, 48_000, &mut used_a);
    let b = alloc_loopback_id("Speakers", 2, 48_000, &mut used_b);
    assert_eq!(a, b);
    assert!(is_stable_loopback_id(&a));
  }

  #[test]
  fn legacy_parse_rejects_non_numeric_suffix() {
    assert_eq!(parse_legacy_output_index("out:3"), Some(3));
    assert_eq!(parse_legacy_output_index("out:h3"), None);
    assert_eq!(parse_legacy_input_index("in:0"), Some(0));
  }
}
