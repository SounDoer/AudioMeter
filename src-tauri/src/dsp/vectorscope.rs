//! Lissajous path + Pearson correlation (matches `useAudioEngine` tick).

pub struct VectorscopeState {
  extent_hold: f64,
}

impl VectorscopeState {
  pub fn new() -> Self {
    Self { extent_hold: 0.02 }
  }

  /// Returns `(correlation, svg_path_d)` using the same geometry as the browser tick.
  pub fn process(&mut self, l: &[f32], r: &[f32]) -> (f64, String) {
    if l.is_empty() || r.is_empty() {
      return (0.0, String::new());
    }
    let n = l.len().min(r.len());
    let inv_sqrt2 = std::f64::consts::FRAC_1_SQRT_2;
    let vs_half = 130.0_f64;
    let vs_safe_inset = 8.0_f64;
    let vs_extent_floor = 0.02_f64;
    let vs_extent_release = 0.965_f64;
    let base_plot_radius = 96.0_f64;
    let mut max_cheb = 0.0_f64;
    let mut i = 0;
    while i < n {
      let lf = l[i].clamp(-1.0, 1.0) as f64;
      let rf = r[i].clamp(-1.0, 1.0) as f64;
      let side = (rf - lf) * inv_sqrt2;
      let mid = (lf + rf) * inv_sqrt2;
      let e = side.abs().max(mid.abs());
      if e > max_cheb {
        max_cheb = e;
      }
      i += 6;
    }
    self.extent_hold *= vs_extent_release;
    if max_cheb > self.extent_hold {
      self.extent_hold = max_cheb;
    }
    self.extent_hold = self.extent_hold.max(vs_extent_floor);
    let eff_plot_radius = base_plot_radius.min((vs_half - vs_safe_inset) / self.extent_hold);
    let mut sum_l = 0.0_f64;
    let mut sum_r = 0.0_f64;
    let mut sum_lr = 0.0_f64;
    let mut vec_pts: Vec<String> = Vec::new();
    i = 0;
    while i < n {
      let lf = l[i].clamp(-1.0, 1.0) as f64;
      let rf = r[i].clamp(-1.0, 1.0) as f64;
      sum_l += lf * lf;
      sum_r += rf * rf;
      sum_lr += lf * rf;
      let side = (rf - lf) * inv_sqrt2;
      let mid = (lf + rf) * inv_sqrt2;
      let x = vs_half + side * eff_plot_radius;
      let y = vs_half - mid * eff_plot_radius;
      vec_pts.push(format!("{x:.2} {y:.2}"));
      i += 6;
    }
    let corr_den = (sum_l * sum_r).sqrt();
    let corr = if corr_den > 1e-9 {
      (sum_lr / corr_den).clamp(-1.0, 1.0)
    } else {
      0.0
    };
    let vp = if vec_pts.is_empty() {
      String::new()
    } else {
      format!("M {}", vec_pts.join(" L "))
    };
    (corr, vp)
  }
}
