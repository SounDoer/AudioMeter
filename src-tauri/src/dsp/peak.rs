//! Block sample peaks (dBFS) from interleaved PCM.

pub fn sample_peak_db_stereo(interleaved_lr: &[f32]) -> (f64, f64) {
  let mut ml = 0.0_f64;
  let mut mr = 0.0_f64;
  let frames = interleaved_lr.len() / 2;
  for i in 0..frames {
    let al = interleaved_lr[i * 2].abs() as f64;
    let ar = interleaved_lr[i * 2 + 1].abs() as f64;
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
