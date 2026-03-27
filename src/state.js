(function () {
  const AM = window.AM || (window.AM = {});

  const S = {
    momentary: -Infinity,
    shortTerm: -Infinity,
    integrated: -Infinity,
    lra: 0,
    truePeak: -Infinity,
    truePeakL: -Infinity,
    truePeakR: -Infinity,
    truePeakMax: -Infinity,
    samplePeak: -Infinity,
    samplePeakL: -Infinity,
    samplePeakR: -Infinity,
    correlation: 0,
    mMax: -Infinity,
    stMax: -Infinity,
    target: -23,
    running: false,
  };

  // History ring buffer: 0.1s per sample, 36000 samples ~= 1 hour.
  const HIST_SAMPLE_SEC = 0.1;
  const HIST_MAX = 36000;
  const HIST_WIN_MIN_SEC = 5;
  const HIST_WIN_MAX_SEC = HIST_MAX * HIST_SAMPLE_SEC;
  let histWindowSec = 120;
  let histViewOffsetSamples = 0;
  const histBuf = new Float32Array(HIST_MAX).fill(-Infinity);
  const mHistBuf = new Float32Array(HIST_MAX).fill(-Infinity);
  const histSnapshots = new Array(HIST_MAX).fill(null);
  const spectrumSnapRing = new Array(HIST_MAX).fill(null);
  const vectorscopeSnapRing = new Array(HIST_MAX).fill(null);
  const vectorscopeCorrRing = new Float32Array(HIST_MAX).fill(0);
  let frozenHistBuf = null;
  let frozenMHistBuf = null;
  let frozenSnapshots = null;
  let frozenSpectrumSnapRing = null;
  let frozenVectorscopeSnapRing = null;
  let frozenVectorscopeCorrRing = null;
  let frozenHistHead = 0;
  let frozenHistCount = 0;
  let histHead = 0;
  let histCount = 0;
  let selectedHistOffset = -1;
  let selectedSnapshot = null;

  /** History 曲线：Momentary / Short-term / Integrated（含 INT 水平线）是否显示 */
  const histCurveVisible = { m: false, st: true, int: false };

  function toggleHistCurve(key) {
    if (key !== 'm' && key !== 'st' && key !== 'int') return false;
    histCurveVisible[key] = !histCurveVisible[key];
    return histCurveVisible[key];
  }

  function isHistCurveVisible(key) {
    return !!(key && histCurveVisible[key]);
  }

  function histPush(v, mv, snap) {
    histBuf[histHead] = v;
    mHistBuf[histHead] = mv;
    histSnapshots[histHead] = snap && typeof snap === 'object' ? { ...snap } : null;
    histHead = (histHead + 1) % HIST_MAX;
    if (histCount < HIST_MAX) histCount++;
  }

  function resetHistory() {
    histBuf.fill(-Infinity);
    mHistBuf.fill(-Infinity);
    histSnapshots.fill(null);
    spectrumSnapRing.fill(null);
    vectorscopeSnapRing.fill(null);
    vectorscopeCorrRing.fill(0);
    histHead = 0;
    histCount = 0;
    selectedHistOffset = -1;
    selectedSnapshot = null;
    frozenHistBuf = null;
    frozenMHistBuf = null;
    frozenSnapshots = null;
    frozenSpectrumSnapRing = null;
    frozenVectorscopeSnapRing = null;
    frozenVectorscopeCorrRing = null;
    frozenHistHead = 0;
    frozenHistCount = 0;
    histViewOffsetSamples = 0;
  }

  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }

  function setHistoryWindowSec(sec) {
    const next = clamp(Number(sec) || histWindowSec, HIST_WIN_MIN_SEC, HIST_WIN_MAX_SEC);
    histWindowSec = next;
    return histWindowSec;
  }

  function scaleHistoryWindow(factor) {
    const f = Number(factor);
    if (!isFinite(f) || f <= 0) return histWindowSec;
    return setHistoryWindowSec(histWindowSec * f);
  }

  function resetHistoryWindow() {
    histWindowSec = 120;
    return histWindowSec;
  }

  function getHistoryWindowSec() {
    return histWindowSec;
  }

  function getHistoryWindowSamples(histCount) {
    const byWindow = Math.max(1, Math.round(histWindowSec / HIST_SAMPLE_SEC));
    return Math.max(1, Math.min(Math.max(1, histCount), byWindow));
  }

  function getMaxHistoryViewOffset(histCount, winSamples) {
    return Math.max(0, Math.max(0, histCount) - Math.max(1, winSamples));
  }

  function setHistoryViewOffsetSamples(offset, histCount, winSamples) {
    const maxOff = getMaxHistoryViewOffset(histCount, winSamples);
    histViewOffsetSamples = clamp(Math.round(Number(offset) || 0), 0, maxOff);
    return histViewOffsetSamples;
  }

  function shiftHistoryViewOffsetSamples(delta, histCount, winSamples) {
    return setHistoryViewOffsetSamples(histViewOffsetSamples + Number(delta || 0), histCount, winSamples);
  }

  function resetHistoryViewOffset() {
    histViewOffsetSamples = 0;
    return histViewOffsetSamples;
  }

  function getHistoryViewOffsetSamples(histCount, winSamples) {
    const maxOff = getMaxHistoryViewOffset(histCount, winSamples);
    if (histViewOffsetSamples > maxOff) histViewOffsetSamples = maxOff;
    if (histViewOffsetSamples < 0) histViewOffsetSamples = 0;
    return histViewOffsetSamples;
  }

  function setSelectedHistOffset(offset) {
    const baseCount = frozenHistBuf ? frozenHistCount : histCount;
    if (baseCount < 1) {
      selectedHistOffset = -1;
      selectedSnapshot = null;
      return;
    }
    if (!frozenHistBuf || !frozenMHistBuf || !frozenSnapshots) {
      frozenHistBuf = new Float32Array(histBuf);
      frozenMHistBuf = new Float32Array(mHistBuf);
      frozenSnapshots = histSnapshots.slice();
      frozenSpectrumSnapRing = spectrumSnapRing.slice();
      frozenVectorscopeSnapRing = vectorscopeSnapRing.slice();
      frozenVectorscopeCorrRing = new Float32Array(vectorscopeCorrRing);
      frozenHistHead = histHead;
      frozenHistCount = histCount;
    }
    selectedHistOffset = clamp(Math.round(Number(offset)), 0, Math.max(0, frozenHistCount - 1));
    const idx = (frozenHistHead - 1 - selectedHistOffset + HIST_MAX) % HIST_MAX;
    const snap = frozenSnapshots[idx];
    selectedSnapshot = snap && typeof snap === 'object' ? { ...snap } : null;
  }

  function clearSelectedHistory() {
    selectedHistOffset = -1;
    selectedSnapshot = null;
    frozenHistBuf = null;
    frozenMHistBuf = null;
    frozenSnapshots = null;
    frozenSpectrumSnapRing = null;
    frozenVectorscopeSnapRing = null;
    frozenVectorscopeCorrRing = null;
    frozenHistHead = 0;
    frozenHistCount = 0;
  }

  function getSelectedSnapshot() {
    return selectedSnapshot;
  }

  function getDisplayState() {
    const snap = getSelectedSnapshot();
    if (!snap) return S;
    return {
      ...S,
      ...snap,
    };
  }

  function getDisplayHistory() {
    if (!selectedSnapshot || !frozenHistBuf || !frozenMHistBuf) {
      return {
        histBuf,
        mHistBuf,
        histHead,
        histCount,
      };
    }
    return {
      histBuf: frozenHistBuf,
      mHistBuf: frozenMHistBuf,
      histHead: frozenHistHead,
      histCount: frozenHistCount,
    };
  }

  function getLatestHistIndex() {
    if (histCount < 1) return -1;
    return (histHead - 1 + HIST_MAX) % HIST_MAX;
  }

  function setSpectrumSnapshotForLatest(curve) {
    const idx = getLatestHistIndex();
    if (idx < 0) return;
    spectrumSnapRing[idx] = curve || null;
  }

  function setVectorscopeSnapshotForLatest(trace, corr) {
    const idx = getLatestHistIndex();
    if (idx < 0) return;
    vectorscopeSnapRing[idx] = trace || null;
    vectorscopeCorrRing[idx] = isFinite(corr) ? corr : 0;
  }

  function getDisplayVisualSnapshot() {
    if (selectedHistOffset < 0) return null;
    const useFrozen = !!(frozenHistBuf && frozenMHistBuf);
    const head = useFrozen ? frozenHistHead : histHead;
    const count = useFrozen ? frozenHistCount : histCount;
    if (count < 1) return null;
    const idx = (head - 1 - selectedHistOffset + HIST_MAX) % HIST_MAX;
    const specRing = useFrozen ? frozenSpectrumSnapRing : spectrumSnapRing;
    const vecRing = useFrozen ? frozenVectorscopeSnapRing : vectorscopeSnapRing;
    const corrRing = useFrozen ? frozenVectorscopeCorrRing : vectorscopeCorrRing;
    return {
      spectrumCurve: (specRing && specRing[idx]) || null,
      vectorscopeTrace: (vecRing && vecRing[idx]) || null,
      correlation: corrRing ? corrRing[idx] : 0,
    };
  }

  AM.state = {
    S,
    HIST_MAX,
    histBuf,
    mHistBuf,
    histSnapshots,
    get histHead() {
      return histHead;
    },
    get histCount() {
      return histCount;
    },
    get selectedHistOffset() {
      return selectedHistOffset;
    },
    histPush,
    resetHistory,
    setSelectedHistOffset,
    clearSelectedHistory,
    getSelectedSnapshot,
    getDisplayState,
    getDisplayHistory,
    setSpectrumSnapshotForLatest,
    setVectorscopeSnapshotForLatest,
    getDisplayVisualSnapshot,
    HIST_SAMPLE_SEC,
    getHistoryWindowSec,
    getHistoryWindowSamples,
    setHistoryWindowSec,
    scaleHistoryWindow,
    resetHistoryWindow,
    getHistoryViewOffsetSamples,
    setHistoryViewOffsetSamples,
    shiftHistoryViewOffsetSamples,
    resetHistoryViewOffset,
    histCurveVisible,
    toggleHistCurve,
    isHistCurveVisible,
  };
})();

