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

/** Spectrum：viewBox 1000×260，与 spectrum 路径生成 `y = 260 - ((d+100)/100)*240` 一致 */
export const SPEC_VIEW_H = 260;
export const SPEC_DB_MIN = -100;
export const SPEC_DB_MAX = 0;
const SPEC_DB_RNG = SPEC_DB_MAX - SPEC_DB_MIN;
/** 有效绘图区在 viewBox 内 y∈[20,260]，高度 240（0 dB 在 y=20，-100 dB 在 y=260） */
export const SPEC_PLOT_H = 240;

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
