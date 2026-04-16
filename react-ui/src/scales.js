/**
 * 与 vanilla `src/renderers/peak.js`（mFrac / vY）、`loudness.js`（dToY）、`spectrum.js`（dToY / fToX）
 * 使用同一套数学关系，供 React UI 刻度与曲线对齐。
 */

/** Peak / Loudness History 共用：-60～+3 dB（与 peak.js MMIN/MMAX 一致） */
export const PEAK_DB_MIN = -60;
export const PEAK_DB_MAX = 3;
const PEAK_DB_RNG = PEAK_DB_MAX - PEAK_DB_MIN;

/** 0..1，+3 dB → 1，-60 dB → 0 */
export function peakFrac(v) {
  const c = Math.max(PEAK_DB_MIN, Math.min(PEAK_DB_MAX, Number.isFinite(v) ? v : PEAK_DB_MIN));
  return (c - PEAK_DB_MIN) / PEAK_DB_RNG;
}

/**
 * 从表盘/坐标区顶部向下的归一化位置：+3 dB → 0，-60 dB → 1。
 * peak.js: vY = PT + (1 - mFrac) * TH，即同一 (1 - mFrac) 关系。
 */
export function peakFromTopFrac(v) {
  return 1 - peakFrac(v);
}

/** Loudness History 独立坐标：-64～0 dB（更贴近常见 LUFS 读数刻度） */
export const LOUDNESS_DB_MIN = -64;
export const LOUDNESS_DB_MAX = 0;
const LOUDNESS_DB_RNG = LOUDNESS_DB_MAX - LOUDNESS_DB_MIN;

/** Loudness：从顶部向下的归一化位置，-3 dB → 0，-64 dB → 1 */
export function loudnessFromTopFrac(v) {
  const c = Math.max(LOUDNESS_DB_MIN, Math.min(LOUDNESS_DB_MAX, Number.isFinite(v) ? v : LOUDNESS_DB_MIN));
  return 1 - (c - LOUDNESS_DB_MIN) / LOUDNESS_DB_RNG;
}

/** Loudness History SVG viewBox 高度 220 时的 y（与 App buildHistoryPath 一致） */
export function loudnessHistY(v, viewH = 220) {
  return viewH * loudnessFromTopFrac(v);
}

/** Spectrum：viewBox 1000×260，0 dB 在 y=0（顶端），-100 dB 在 y=260（底端） */
export const SPEC_VIEW_H = 260;
export const SPEC_DB_MIN = -100;
export const SPEC_DB_MAX = 0;
const SPEC_DB_RNG = SPEC_DB_MAX - SPEC_DB_MIN;
/** 有效绘图区占满整个 viewBox 高度（0 dB → y=0，-100 dB → y=260） */
export const SPEC_PLOT_H = 260;

/** React Spectrum：FFT→RTA 呈现层默认参数（与 UI 主题无关，见 App tick） */
export const SPECTRUM_SETTINGS = {
  resolution: "1/6", // 1/3 | 1/6 | 1/12
  weighting: "z", // z | a | c
  smoothing: "normal", // fast | normal | slow
  showPeakHold: true,
  peakHoldMs: 1000,
  peakDecayDbPerSec: 12,
  freqSmoothingKernel: [0.2, 0.6, 0.2],
  tiltDbPerOctave: 0,
  freeze: false,
  minHz: 20,
  maxHz: 20000,
};

export function spectrumDbToYViewBox(d) {
  const dd = Math.max(SPEC_DB_MIN, Math.min(SPEC_DB_MAX, Number.isFinite(d) ? d : SPEC_DB_MIN));
  return SPEC_VIEW_H - ((dd - SPEC_DB_MIN) / SPEC_DB_RNG) * SPEC_PLOT_H;
}

/** 刻度线相对整个 viewBox 高度的 top 百分比（与 spectrum 曲线同一坐标系） */
export function spectrumDbToTopFrac(d) {
  return spectrumDbToYViewBox(d) / SPEC_VIEW_H;
}

const LOG20 = Math.log10(20);
const LOG20K = Math.log10(20000);
const LOG_DEN = LOG20K - LOG20;

/** 频率 Hz → [0,1]，用于对数横轴刻度位置（与 spectrum.js fToX 一致） */
export function freqToXFrac(f) {
  const ff = Math.max(20, Math.min(20000, f));
  return (Math.log10(ff) - LOG20) / LOG_DEN;
}

const RTA_BANDS_PER_OCTAVE = {
  "1/3": 3,
  "1/6": 6,
  "1/12": 12,
};

export function getRtaBandsPerOctave(resolution = "1/6") {
  return RTA_BANDS_PER_OCTAVE[resolution] || RTA_BANDS_PER_OCTAVE["1/6"];
}

export function buildRtaBands(minHz = 20, maxHz = 20000, resolution = "1/6") {
  const lo = Math.max(1, minHz);
  const hi = Math.max(lo + 1, maxHz);
  const n = getRtaBandsPerOctave(resolution);
  const half = Math.pow(2, 1 / (2 * n));
  const step = Math.pow(2, 1 / n);
  const bands = [];
  let center = lo;
  for (let guard = 0; guard < 512 && center <= hi * 1.001; guard += 1) {
    const fLow = center / half;
    const fHigh = center * half;
    if (fHigh >= lo && fLow <= hi) {
      bands.push({
        fLow: Math.max(lo, fLow),
        fHigh: Math.min(hi, fHigh),
        fCenter: center,
      });
    }
    center *= step;
  }
  return bands;
}

function weightingA(fHz) {
  const f2 = fHz * fHz;
  const num = 12194 * 12194 * f2 * f2;
  const den =
    (f2 + 20.6 * 20.6) *
    Math.sqrt((f2 + 107.7 * 107.7) * (f2 + 737.9 * 737.9)) *
    (f2 + 12194 * 12194);
  return 2 + 20 * Math.log10(Math.max(1e-20, num / den));
}

function weightingC(fHz) {
  const f2 = fHz * fHz;
  const num = 12194 * 12194 * f2;
  const den = (f2 + 20.6 * 20.6) * (f2 + 12194 * 12194);
  return 0.06 + 20 * Math.log10(Math.max(1e-20, num / den));
}

export function getWeightingDb(freqHz, mode = "z") {
  const f = Math.max(10, freqHz);
  if (mode === "a") return weightingA(f);
  if (mode === "c") return weightingC(f);
  return 0;
}

/** Peak 表盘左侧主刻度（与 peak.js TICKS 中常用子集一致，可按需增删） */
export const PEAK_TICKS = [
  { v: 3, lb: "+3" },
  { v: 0, lb: "0" },
  { v: -6, lb: "-6" },
  { v: -12, lb: "-12" },
  { v: -24, lb: "-24" },
  { v: -48, lb: "-48" },
  { v: -60, lb: "-60" },
];

/** Loudness History 左侧刻度（dB 值落在 -60～+3 内方可与曲线对齐） */
export const LOUDNESS_TICKS = [
  { v: 0, lb: "0" },
  { v: -6, lb: "-6" },
  { v: -12, lb: "-12" },
  { v: -18, lb: "-18" },
  { v: -27, lb: "-27" },
  { v: -36, lb: "-36" },
  { v: -45, lb: "-45" },
  { v: -54, lb: "-54" },
  { v: -63, lb: "-63" },
];

/** Spectrum 左侧 dB 刻度（-100～0） */
export const SPEC_Y_TICKS = [
  { v: 0, lb: "0" },
  { v: -20, lb: "-20" },
  { v: -40, lb: "-40" },
  { v: -60, lb: "-60" },
  { v: -80, lb: "-80" },
];

/** 与 src/renderers/spectrum.js FREQ_LABELS 一致 */
export const FREQ_LABELS = [
  [20, "20"],
  [50, "50"],
  [100, "100"],
  [200, "200"],
  [500, "500"],
  [1000, "1k"],
  [2000, "2k"],
  [5000, "5k"],
  [10000, "10k"],
  [20000, "20k"],
];
