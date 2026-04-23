//! Block sample peaks (dBFS) from interleaved PCM.

/// Interleaved PCM: `channels` samples per frame; peak meters use **first two channels per frame** (v1.0 stereo-style; `channels==1` uses the mono path).
pub fn sample_peak_db_interleaved(interleaved: &[f32], channels: u16) -> (f64, f64) {
  let ch = channels.max(1) as usize;
  if ch == 1 {
    return sample_peak_db_mono(interleaved);
  }
  let mut ml = 0.0_f64;
  let mut mr = 0.0_f64;
  let frames = interleaved.len() / ch;
  for i in 0..frames {
    let al = interleaved[i * ch].abs() as f64;
    let ar = interleaved[i * ch + 1].abs() as f64;
    if al > ml {
      ml = al;
    }
    if ar > mr {
      mr = ar;
    }
  }
  let dl = if ml > 0.0 {
    20.0 * ml.log10()
  } else {
    f64::NEG_INFINITY
  };
  let dr = if mr > 0.0 {
    20.0 * mr.log10()
  } else {
    f64::NEG_INFINITY
  };
  (dl, dr)
}

pub fn sample_peak_db_mono(mono: &[f32]) -> (f64, f64) {
  let mut m = 0.0_f64;
  for &s in mono {
    let a = s.abs() as f64;
    if a > m {
      m = a;
    }
  }
  let d = if m > 0.0 {
    20.0 * m.log10()
  } else {
    f64::NEG_INFINITY
  };
  (d, d)
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn interleaved_stereo_uses_lr_pairs() {
    let interleaved = [0.5_f32, -0.25, 0.1, 0.9];
    let (l, r) = sample_peak_db_interleaved(&interleaved, 2);
    let el = 20.0 * 0.5_f64.log10();
    let er = 20.0 * 0.9_f64.log10();
    assert!((l - el).abs() < 1e-5, "l={l} expected ~{el}");
    assert!((r - er).abs() < 1e-5, "r={r} expected ~{er}");
  }

  #[test]
  fn interleaved_quad_first_two_channels_only() {
    // frames: (L,R,C,LFE) — peak L/R must ignore C/LFE (third/fourth sample each frame)
    let interleaved = [
      0.1_f32, 0.2, 1.0, 1.0, // frame 0: L/R small, C/LFE huge
      0.5, 0.5, 0.0, 0.0, // frame 1
    ];
    let (l, r) = sample_peak_db_interleaved(&interleaved, 4);
    let el = 20.0 * 0.5_f64.log10();
    assert!((l - el).abs() < 1e-5);
    assert!((r - el).abs() < 1e-5);
  }

  #[test]
  fn mono_duplex_matches_interleaved_ch1() {
    let mono = [0.25_f32, -0.4];
    let (a, b) = sample_peak_db_interleaved(&mono, 1);
    let (c, d) = sample_peak_db_mono(&mono);
    assert_eq!((a, b), (c, d));
  }
}
