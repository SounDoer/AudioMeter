//! Block sample peaks (dBFS) from interleaved PCM.

/// 交错 PCM：`channels` 路/帧；峰值表头取 **每帧前两路**（与 v1.0 立体声表头一致；`channels==1` 走 mono）。
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
  let dl = if ml > 0.0 { 20.0 * ml.log10() } else { f64::NEG_INFINITY };
  let dr = if mr > 0.0 { 20.0 * mr.log10() } else { f64::NEG_INFINITY };
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
  let d = if m > 0.0 { 20.0 * m.log10() } else { f64::NEG_INFINITY };
  (d, d)
}
