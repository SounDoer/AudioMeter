//! Spectrum SVG path (same math as `src/math/spectrumMath.js` + `scales.js`).

const SPECTRUM_VIEW_W: f64 = 1000.0;
const SPEC_VIEW_H: f64 = 260.0;
const SPEC_VIEW_TOP_PAD: f64 = 10.0;
const SPEC_VIEW_BOTTOM_PAD: f64 = 4.0;
const SPEC_DB_MIN: f64 = -100.0;
const SPEC_DB_MAX: f64 = 0.0;

fn freq_to_x_frac(f: f64) -> f64 {
  let ff = f.clamp(20.0, 20000.0);
  let log20 = 20_f64.log10();
  let log20k = 20000_f64.log10();
  (ff.log10() - log20) / (log20k - log20)
}

fn spectrum_db_to_y_viewbox(d: f64) -> f64 {
  let dd = d.clamp(SPEC_DB_MIN, SPEC_DB_MAX);
  let plot_h = SPEC_VIEW_H - SPEC_VIEW_TOP_PAD - SPEC_VIEW_BOTTOM_PAD;
  SPEC_VIEW_H - SPEC_VIEW_BOTTOM_PAD - ((dd - SPEC_DB_MIN) / (SPEC_DB_MAX - SPEC_DB_MIN)) * plot_h
}

pub fn spectrum_paths_from_bands(centers: &[f64], smooth_db: &[f64], peak_db: &[f64], show_peak_hold: bool) -> (String, String) {
  if centers.len() != smooth_db.len() || centers.is_empty() {
    return (String::new(), String::new());
  }
  let mut live = Vec::new();
  for i in 0..centers.len() {
    let x = freq_to_x_frac(centers[i]) * SPECTRUM_VIEW_W;
    let y = spectrum_db_to_y_viewbox(smooth_db[i]);
    live.push(format!("{x:.2} {y:.2}"));
  }
  let path = if live.is_empty() {
    String::new()
  } else {
    format!("M {}", live.join(" L "))
  };
  let peak_path = if show_peak_hold && peak_db.len() == centers.len() {
    let mut pk = Vec::new();
    for i in 0..centers.len() {
      let x = freq_to_x_frac(centers[i]) * SPECTRUM_VIEW_W;
      let y = spectrum_db_to_y_viewbox(peak_db[i]);
      pk.push(format!("{x:.2} {y:.2}"));
    }
    if pk.is_empty() {
      String::new()
    } else {
      format!("M {}", pk.join(" L "))
    }
  } else {
    String::new()
  };
  (path, peak_path)
}
