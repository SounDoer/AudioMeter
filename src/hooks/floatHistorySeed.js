import { buildSpectrumDataSnapshot } from "./tauriFrameApply.js";

/**
 * Normalize `get_meter_history` / serde row field names to the shape used by `useSnapshot` ref arrays.
 * @param {object} row
 * @returns {import("../ipc/types.js").MeterHistoryEntry}
 */
function normalizeHistoryRow(row) {
  return {
    lufsMomentary: num(row.lufsMomentary ?? row.lufs_momentary),
    lufsShortTerm: num(row.lufsShortTerm ?? row.lufs_short_term),
    integrated: num(row.integrated),
    lra: num(row.lra),
    truePeakL: num(row.truePeakL ?? row.true_peak_l),
    truePeakR: num(row.truePeakR ?? row.true_peak_r),
    truePeakMaxDbtp: num(row.truePeakMaxDbtp ?? row.true_peak_max_dbtp),
    sampleLDb: num(row.sampleLdb ?? row.sampleLDb ?? row.sample_l_db),
    sampleRDb: num(row.sampleRdb ?? row.sampleRDb ?? row.sample_r_db),
    samplePeakMaxL: num(row.samplePeakMaxL ?? row.sample_peak_max_l),
    samplePeakMaxR: num(row.samplePeakMaxR ?? row.sample_peak_max_r),
    correlation: num(row.correlation),
    vectorscopePath: str(row.vectorscopePath ?? row.vectorscope_path),
    spectrumPath: str(row.spectrumPath ?? row.spectrum_path),
    spectrumPeakPath: str(row.spectrumPeakPath ?? row.spectrum_peak_path),
    spectrumBandCentersHz: arrNum(row.spectrumBandCentersHz ?? row.spectrum_band_centers_hz),
    spectrumSmoothDb: arrNum(row.spectrumSmoothDb ?? row.spectrum_smooth_db),
  };
}

function num(v) {
  return Number.isFinite(v) ? v : -Infinity;
}
function str(v) {
  return typeof v === "string" ? v : "";
}
function arrNum(a) {
  return Array.isArray(a) ? a : [];
}

/**
 * @param {object[]} rawRows
 * @param {object} ctx
 * @param {number} ctx.histMaxSamples
 * @param {number} ctx.defaultSampleRate
 * @param {import("react").MutableRefObject<{ m: number; st: number }[]>} ctx.loudnessHistRef
 * @param {import("react").MutableRefObject} ctx.spectrumDataRef
 * @param {import("react").MutableRefObject} ctx.spectrumDataSnapRef
 * @param {import("react").MutableRefObject} ctx.spectrumSnapRef
 * @param {import("react").MutableRefObject} ctx.vectorSnapRef
 * @param {import("react").MutableRefObject} ctx.corrSnapRef
 * @param {import("react").MutableRefObject} ctx.audioSnapRef
 * @param {import("react").MutableRefObject} ctx.histRef
 * @param {(updater: (prev: object) => object) => void} ctx.setAudio
 * @param {(s: string) => void} ctx.setSpectrumPath
 * @param {(s: string) => void} ctx.setSpectrumPeakPath
 * @param {(s: string) => void} ctx.setVectorPath
 */
export function seedFloatHistoryFromRows(rawRows, ctx) {
  const {
    histMaxSamples,
    defaultSampleRate,
    loudnessHistRef,
    spectrumDataRef,
    spectrumDataSnapRef,
    spectrumSnapRef,
    vectorSnapRef,
    corrSnapRef,
    audioSnapRef,
    histRef,
    setAudio,
    setSpectrumPath,
    setSpectrumPeakPath,
    setVectorPath,
  } = ctx;
  const pick = { defaultSampleRate: defaultSampleRate || 48000 };
  if (!rawRows || !rawRows.length) {
    return;
  }
  const rows = rawRows.map(normalizeHistoryRow);

  loudnessHistRef.current = [];
  spectrumDataSnapRef.current = [];
  spectrumSnapRef.current = [];
  vectorSnapRef.current = [];
  corrSnapRef.current = [];
  audioSnapRef.current = [];

  for (const row of rows) {
    const hm = Number.isFinite(row.lufsMomentary) ? row.lufsMomentary : -Infinity;
    const hst = Number.isFinite(row.lufsShortTerm) ? row.lufsShortTerm : -Infinity;
    loudnessHistRef.current.push({ m: hm, st: hst });
    if (loudnessHistRef.current.length > histMaxSamples) loudnessHistRef.current.shift();

    const snap = {
      momentary: hm,
      shortTerm: hst,
      integrated: Number.isFinite(row.integrated) ? row.integrated : -Infinity,
      lra: Number.isFinite(row.lra) ? row.lra : -Infinity,
      truePeakL: Number.isFinite(row.truePeakL) ? row.truePeakL : -Infinity,
      truePeakR: Number.isFinite(row.truePeakR) ? row.truePeakR : -Infinity,
      tpMax: Number.isFinite(row.truePeakMaxDbtp) ? row.truePeakMaxDbtp : -Infinity,
      samplePeak: Number.isFinite(row.truePeakMaxDbtp) ? row.truePeakMaxDbtp : -Infinity,
      tpL: Number.isFinite(row.sampleLDb) ? row.sampleLDb : -Infinity,
      tpR: Number.isFinite(row.sampleRDb) ? row.sampleRDb : -Infinity,
      sampleL: Number.isFinite(row.sampleLDb) ? row.sampleLDb : -Infinity,
      sampleR: Number.isFinite(row.sampleRDb) ? row.sampleRDb : -Infinity,
      samplePeakMaxL: Number.isFinite(row.samplePeakMaxL) ? row.samplePeakMaxL : -Infinity,
      samplePeakMaxR: Number.isFinite(row.samplePeakMaxR) ? row.samplePeakMaxR : -Infinity,
      correlation: Number.isFinite(row.correlation) ? row.correlation : 0,
    };
    audioSnapRef.current.push(snap);
    if (audioSnapRef.current.length > histMaxSamples) audioSnapRef.current.shift();

    const c = Number.isFinite(row.correlation) ? row.correlation : 0;
    corrSnapRef.current.push(c);
    if (corrSnapRef.current.length > histMaxSamples) corrSnapRef.current.shift();
    vectorSnapRef.current.push(row.vectorscopePath || "");
    if (vectorSnapRef.current.length > histMaxSamples) vectorSnapRef.current.shift();
    spectrumSnapRef.current.push(row.spectrumPath || "");
    if (spectrumSnapRef.current.length > histMaxSamples) spectrumSnapRef.current.shift();
    spectrumDataSnapRef.current.push(buildSpectrumDataSnapshot(row, pick));
    if (spectrumDataSnapRef.current.length > histMaxSamples) spectrumDataSnapRef.current.shift();
  }

  histRef.current = loudnessHistRef.current;
  const last = rows[rows.length - 1];
  const sd = buildSpectrumDataSnapshot(last, pick);
  spectrumDataRef.current = sd;
  setSpectrumPath(last.spectrumPath || "");
  setSpectrumPeakPath(last.spectrumPeakPath || "");
  setVectorPath(last.vectorscopePath || "");

  setAudio(() => ({
    momentary: Number.isFinite(last.lufsMomentary) ? last.lufsMomentary : -Infinity,
    shortTerm: Number.isFinite(last.lufsShortTerm) ? last.lufsShortTerm : -Infinity,
    integrated: Number.isFinite(last.integrated) ? last.integrated : -Infinity,
    mMax: -Infinity,
    stMax: -Infinity,
    lra: Number.isFinite(last.lra) ? last.lra : -Infinity,
    tpL: Number.isFinite(last.sampleLDb) ? last.sampleLDb : -Infinity,
    tpR: Number.isFinite(last.sampleRDb) ? last.sampleRDb : -Infinity,
    truePeakL: Number.isFinite(last.truePeakL) ? last.truePeakL : -Infinity,
    truePeakR: Number.isFinite(last.truePeakR) ? last.truePeakR : -Infinity,
    tpMax: Number.isFinite(last.truePeakMaxDbtp) ? last.truePeakMaxDbtp : -Infinity,
    samplePeakMaxL: Number.isFinite(last.samplePeakMaxL) ? last.samplePeakMaxL : -Infinity,
    samplePeakMaxR: Number.isFinite(last.samplePeakMaxR) ? last.samplePeakMaxR : -Infinity,
    sampleL: Number.isFinite(last.sampleLDb) ? last.sampleLDb : -Infinity,
    sampleR: Number.isFinite(last.sampleRDb) ? last.sampleRDb : -Infinity,
    samplePeak: Number.isFinite(last.truePeakMaxDbtp) ? last.truePeakMaxDbtp : -Infinity,
    correlation: Number.isFinite(last.correlation) ? last.correlation : 0,
  }));
}
