import { useEffect, useMemo, useRef, useState } from "react";
import {
  peakFromTopFrac,
  loudnessHistY,
  spectrumDbToYViewBox,
  spectrumDbToTopFrac,
  freqToXFrac,
  PEAK_TICKS,
  LOUDNESS_TICKS,
  SPEC_Y_TICKS,
  FREQ_LABELS,
} from "./scales";
import { UI_PREFERENCES, applyUiPreferencesToDocument, mergeCharts, readPersistedUiMode } from "./uiPreferences";
const HIST_SAMPLE_SEC = 0.1;
const HIST_MAX_SAMPLES = 36000;

function PillButton({ children, accent = false, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={accent ? "ui-pill ui-pill-accent" : "ui-pill ui-pill-default"}
    >
      {children}
    </button>
  );
}

function MetricRow({ label, value, unit }) {
  const { valueColumnCh, unitColumnRem } = UI_PREFERENCES.loudnessMetrics;
  return (
    <div className="ui-metric-row">
      <span className="ui-metric-label">{label}</span>
      <span className="ui-metric-value" style={{ width: `${valueColumnCh}ch` }}>
        {value}
      </span>
      <span className="ui-metric-unit" style={{ width: `${unitColumnRem}rem` }}>
        {unit}
      </span>
    </div>
  );
}

function valueClassByCorr(corr) {
  if (corr < -0.2) return "ui-corr-bad";
  if (corr < 0.2) return "ui-corr-mid";
  return "ui-corr-good";
}

export default function App() {
  const STORE_KEY = UI_PREFERENCES.layoutPersistKey;
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [uiMode, setUiMode] = useState(() => readPersistedUiMode());
  const [standard, setStandard] = useState("ebu");
  const [running, setRunning] = useState(false);
  const [selectedOffset, setSelectedOffset] = useState(-1);
  const [historyWindowSec, setHistoryWindowSec] = useState(UI_PREFERENCES.history.defaultWindowSec);
  const [historyOffsetSec, setHistoryOffsetSec] = useState(0);
  const [status, setStatus] = useState("Ready - click Start to begin monitoring");
  const [status2, setStatus2] = useState("Input: System default microphone");
  const [histCurves, setHistCurves] = useState({ m: false, st: true });
  const [audio, setAudio] = useState({
    momentary: -Infinity,
    shortTerm: -Infinity,
    integrated: -Infinity,
    mMax: -Infinity,
    stMax: -Infinity,
    lra: 0,
    tpL: -Infinity,
    tpR: -Infinity,
    truePeakL: -Infinity,
    truePeakR: -Infinity,
    tpMax: -Infinity,
    samplePeakMaxL: -Infinity,
    samplePeakMaxR: -Infinity,
    sampleL: -Infinity,
    sampleR: -Infinity,
    samplePeak: -Infinity,
    correlation: 0,
  });
  const [spectrumPath, setSpectrumPath] = useState("");
  const [vectorPath, setVectorPath] = useState("");
  const [historyPathM, setHistoryPathM] = useState("");
  const [historyPathST, setHistoryPathST] = useState("");
  const [mainLeft, setMainLeft] = useState(UI_PREFERENCES.mainColumn.initialPx);
  const [leftTopRatio, setLeftTopRatio] = useState(UI_PREFERENCES.leftSplit.initialRatio);
  const [rightTopRatio, setRightTopRatio] = useState(UI_PREFERENCES.rightSplit.initialRatio);
  /** History 与 Metrics 横向分割：History 列占行宽的份额（其余给 Metrics） */
  const [loudnessHistWidthRatio, setLoudnessHistWidthRatio] = useState(UI_PREFERENCES.loudnessHistMetrics.initialRatio);
  const dragModeRef = useRef(null);
  const panStartRef = useRef({ x: 0, offset: 0 });
  const lastRightDownTsRef = useRef(0);
  const layoutDragRef = useRef(null);
  const audioRef = useRef(null);
  const rafRef = useRef(0);
  const frameRef = useRef(0);
  const histRef = useRef([]);
  const loudnessHistRef = useRef([]);
  const spectrumSnapRef = useRef([]);
  const vectorSnapRef = useRef([]);
  const corrSnapRef = useRef([]);
  const audioSnapRef = useRef([]);
  const selectedOffsetRef = useRef(-1);
  const frozenSnapRef = useRef(null);

  const historyLegend = useMemo(() => {
    const mode = uiMode === "light" ? "light" : "dark";
    const ch = mergeCharts(UI_PREFERENCES.charts, UI_PREFERENCES.themes[mode]?.charts);
    return [
      { key: "m", label: "Momentary", color: ch.loudnessHistory.momentaryStroke },
      { key: "st", label: "Short-term", color: ch.loudnessHistory.shortTermStroke },
    ];
  }, [uiMode]);
  const historyTimeTicks = useMemo(() => {
    const steps = 4;
    const ticks = [];
    for (let i = 0; i <= steps; i++) {
      const sec = Math.round(historyOffsetSec + (historyWindowSec * (steps - i)) / steps);
      if (i === steps) {
        ticks.push("Now");
      } else if (sec >= 60) {
        const m = Math.floor(sec / 60);
        const s = sec % 60;
        ticks.push(`${m}m${s ? `${s}s` : ""}`);
      } else {
        ticks.push(`${sec}s`);
      }
    }
    return ticks;
  }, [historyOffsetSec, historyWindowSec]);
  const fmt = (v) => (Number.isFinite(v) ? v.toFixed(1) : "—");

  const primaryMetrics = [
    { label: "Momentary", value: fmt(audio.momentary), unit: "LUFS" },
    { label: "Short-term", value: fmt(audio.shortTerm), unit: "LUFS" },
    { label: "Integrated", value: fmt(audio.integrated), unit: "LUFS" },
    { label: "Momentary Max", value: fmt(audio.mMax), unit: "LUFS" },
    { label: "Short-term Max", value: fmt(audio.stMax), unit: "LUFS" },
    { label: "Loudness Range (LRA)", value: fmt(audio.lra), unit: "LU" },
  ];
  const psr = Number.isFinite(audio.tpMax) && Number.isFinite(audio.shortTerm) ? audio.tpMax - audio.shortTerm : -Infinity;
  const plr = Number.isFinite(audio.tpMax) && Number.isFinite(audio.integrated) ? audio.tpMax - audio.integrated : -Infinity;
  const secondaryMetrics = [
    { label: "Dynamics (PSR)", value: fmt(psr), unit: "dB" },
    { label: "Avg. Dynamics (PLR)", value: fmt(plr), unit: "dB" },
  ];

  const toggleCurve = (key) => setHistCurves((prev) => ({ ...prev, [key]: !prev[key] }));
  const targetLufs = standard === "ebu" ? -23 : -14;
  const snapSourceHistory = selectedOffset >= 0 && frozenSnapRef.current ? frozenSnapRef.current : null;
  const histSourceList = snapSourceHistory ? snapSourceHistory.loudness : loudnessHistRef.current;
  const snapSource = selectedOffset >= 0 && frozenSnapRef.current ? frozenSnapRef.current : null;
  const snapCorrList = snapSource ? snapSource.corr : corrSnapRef.current;
  const snapSpecList = snapSource ? snapSource.spectrum : spectrumSnapRef.current;
  const snapVecList = snapSource ? snapSource.vector : vectorSnapRef.current;
  const snapAudioList = snapSource ? snapSource.audio : audioSnapRef.current;
  const selectedHistSteps = selectedOffset >= 0 ? Math.max(0, Math.round(selectedOffset / HIST_SAMPLE_SEC)) : -1;
  const snapIdx = selectedHistSteps >= 0 ? Math.max(0, snapSpecList.length - 1 - selectedHistSteps) : -1;
  const audioSnapIdx = selectedHistSteps >= 0 ? Math.max(0, snapAudioList.length - 1 - selectedHistSteps) : -1;
  const displayAudio = audioSnapIdx >= 0 && snapAudioList[audioSnapIdx] ? snapAudioList[audioSnapIdx] : audio;
  const displaySpectrumPath = snapIdx >= 0 && snapSpecList[snapIdx] ? snapSpecList[snapIdx] : spectrumPath;
  const displayVectorPath = snapIdx >= 0 && snapVecList[snapIdx] ? snapVecList[snapIdx] : vectorPath;
  const correlation = snapIdx >= 0 && Number.isFinite(snapCorrList[snapIdx]) ? snapCorrList[snapIdx] : displayAudio.correlation;
  const startMode = selectedOffset >= 0 ? "live" : running ? "stop" : "start";
  const startLabel = startMode === "live" ? "LIVE" : startMode === "stop" ? "STOP" : "START";
  const totalSamples = histSourceList.length;
  const availableSec = Math.max(0, totalSamples * HIST_SAMPLE_SEC);
  const clampedWindowSec = Math.max(5, Math.min(1800, historyWindowSec));
  const windowSamples = Math.max(1, Math.round(clampedWindowSec / HIST_SAMPLE_SEC));
  const visibleSamples = Math.max(1, Math.min(Math.max(1, totalSamples), windowSamples));
  const maxOffsetSamples = Math.max(0, totalSamples - visibleSamples);
  const effectiveOffsetSamples = Math.max(0, Math.min(maxOffsetSamples, Math.round(historyOffsetSec / HIST_SAMPLE_SEC)));
  const effectiveOffsetSec = effectiveOffsetSamples * HIST_SAMPLE_SEC;

  const buildHistoryPath = (key) => {
    if (!histSourceList.length) return "";
    const total = histSourceList.length;
    const winSamples = Math.max(2, visibleSamples);
    const offSamples = Math.max(0, Math.min(Math.max(0, total - 2), effectiveOffsetSamples));
    const end = Math.max(1, total - offSamples);
    const start = Math.max(0, end - winSamples);
    const view = histSourceList.slice(start, end);
    if (view.length < 2) return "";
    const toY = (v) => loudnessHistY(v, 220);
    return view
      .map((p, i) => `${i === 0 ? "M" : "L"} ${(i / Math.max(1, view.length - 1)) * 600} ${toY(p[key])}`)
      .join(" ");
  };

  const displayHistoryPathM = buildHistoryPath("m");
  const displayHistoryPathST = buildHistoryPath("st");
  const showSelLine = selectedHistSteps >= effectiveOffsetSamples && selectedHistSteps <= Math.max(0, effectiveOffsetSamples + visibleSamples - 1);
  const selLineX = Math.max(
    0,
    Math.min(
      600,
      600 - ((selectedHistSteps - effectiveOffsetSamples) / Math.max(1, visibleSamples - 1)) * 600
    )
  );

  const clearAll = () => {
    if (audioRef.current?.wklt) {
      try {
        audioRef.current.wklt.port.postMessage("reset");
      } catch (_) {}
    }
    histRef.current = [];
    loudnessHistRef.current = [];
    spectrumSnapRef.current = [];
    vectorSnapRef.current = [];
    corrSnapRef.current = [];
    audioSnapRef.current = [];
    frozenSnapRef.current = null;
    setSpectrumPath("");
    setVectorPath("");
    setHistoryPathM("");
    setHistoryPathST("");
    setAudio({
      momentary: -Infinity, shortTerm: -Infinity, integrated: -Infinity, mMax: -Infinity, stMax: -Infinity, lra: 0,
      tpL: -Infinity,
      tpR: -Infinity,
      truePeakL: -Infinity,
      truePeakR: -Infinity,
      tpMax: -Infinity,
      samplePeakMaxL: -Infinity,
      samplePeakMaxR: -Infinity,
      sampleL: -Infinity,
      sampleR: -Infinity,
      samplePeak: -Infinity,
      correlation: 0,
    });
    setSelectedOffset(-1);
    setHistoryOffsetSec(0);
    setHistoryWindowSec(UI_PREFERENCES.history.defaultWindowSec);
    setStatus(running ? "Running - cleared history and peak hold" : "Ready - click Start to begin monitoring");
  };
  const resetLayout = () => {
    setMainLeft(UI_PREFERENCES.mainColumn.initialPx);
    setLeftTopRatio(UI_PREFERENCES.leftSplit.initialRatio);
    setRightTopRatio(UI_PREFERENCES.rightSplit.initialRatio);
    setLoudnessHistWidthRatio(UI_PREFERENCES.loudnessHistMetrics.initialRatio);
  };
  const onStartClick = () => {
    if (selectedOffset >= 0) return void (setSelectedOffset(-1), setStatus("Returned to live view"));
    if (running) {
      setRunning(false);
      setStatus("Stopped - click Start to resume");
      setStatus2("Input: None");
      return;
    }
    setRunning(true);
  };
  /** rect 为 history 曲线区域（不含左侧 LUFS 刻度、不含底部时间轴与按钮行） */
  const updateSelectionFromClientX = (clientX, rect) => {
    const width = Math.max(1, rect.width);
    const x = Math.max(0, Math.min(width, clientX - rect.left));
    const normalized = 1 - x / width;
    const fromEndSamples = effectiveOffsetSamples + normalized * Math.max(0, visibleSamples - 1);
    setSelectedOffset(Math.round(fromEndSamples) * HIST_SAMPLE_SEC);
  };
  const onHistoryPointerDown = (ev) => {
    const rect = ev.currentTarget.getBoundingClientRect();
    if (ev.button === 0) {
      dragModeRef.current = "select";
      updateSelectionFromClientX(ev.clientX, rect);
    } else if (ev.button === 2) {
      const nowTs = (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();
      if (nowTs - lastRightDownTsRef.current <= 320) {
        setHistoryWindowSec(UI_PREFERENCES.history.defaultWindowSec);
        setHistoryOffsetSec(0);
        lastRightDownTsRef.current = 0;
        return;
      }
      lastRightDownTsRef.current = nowTs;
      if (totalSamples <= visibleSamples) return;
      dragModeRef.current = "pan";
      panStartRef.current = { x: ev.clientX, offset: effectiveOffsetSec };
    } else return;
    try {
      ev.currentTarget.setPointerCapture(ev.pointerId);
    } catch (_) {}
  };
  const onHistoryPointerMove = (ev) => {
    const mode = dragModeRef.current;
    if (!mode) return;
    const rect = ev.currentTarget.getBoundingClientRect();
    if (mode === "select") return void updateSelectionFromClientX(ev.clientX, rect);
    const dx = ev.clientX - panStartRef.current.x;
    const secPerPx = (visibleSamples * HIST_SAMPLE_SEC) / Math.max(1, rect.width);
    const next = Math.max(0, Math.min(maxOffsetSamples * HIST_SAMPLE_SEC, panStartRef.current.offset + dx * secPerPx));
    setHistoryOffsetSec(next);
  };
  const onHistoryPointerUp = (ev) => {
    dragModeRef.current = null;
    try {
      ev.currentTarget.releasePointerCapture(ev.pointerId);
    } catch (_) {}
  };
  const onHistoryWheel = (ev) => {
    ev.preventDefault();
    const factor = ev.deltaY < 0 ? 0.85 : 1.18;
    const rect = ev.currentTarget.getBoundingClientRect();
    const width = Math.max(1, rect.width);
    const x = Math.max(0, Math.min(width, ev.clientX - rect.left));
    const norm = 1 - x / width;
    const anchorFromEndSamples = effectiveOffsetSamples + norm * Math.max(0, visibleSamples - 1);
    const baselineSec = Math.max(HIST_SAMPLE_SEC, visibleSamples * HIST_SAMPLE_SEC);
    const next = Math.max(5, Math.min(1800, baselineSec * factor));
    const nextVisibleSamples = Math.max(1, Math.min(Math.max(1, totalSamples), Math.round(next / HIST_SAMPLE_SEC)));
    const nextMaxOffsetSamples = Math.max(0, totalSamples - nextVisibleSamples);
    const nextOffsetSamples = Math.max(
      0,
      Math.min(
        nextMaxOffsetSamples,
        Math.round(anchorFromEndSamples - norm * Math.max(0, nextVisibleSamples - 1))
      )
    );
    setHistoryWindowSec(next);
    setHistoryOffsetSec(nextOffsetSamples * HIST_SAMPLE_SEC);
  };
  const beginLayoutDrag = (mode, ev) => {
    layoutDragRef.current = {
      mode,
      x: ev.clientX,
      y: ev.clientY,
      mainLeft,
      leftTopRatio,
      rightTopRatio,
      loudnessHistWidthRatio,
    };
    try {
      ev.currentTarget.setPointerCapture(ev.pointerId);
    } catch (_) {}
  };
  const onLayoutDragMove = (ev) => {
    const d = layoutDragRef.current;
    if (!d) return;
    if (d.mode === "main") {
      const { dragMinPx, dragMaxPx } = UI_PREFERENCES.mainColumn;
      setMainLeft(Math.max(dragMinPx, Math.min(dragMaxPx, d.mainLeft + (ev.clientX - d.x))));
    } else if (d.mode === "left") {
      const { dragMinRatio, dragMaxRatio, dragPixelsPerDelta } = UI_PREFERENCES.leftSplit;
      setLeftTopRatio(Math.max(dragMinRatio, Math.min(dragMaxRatio, d.leftTopRatio + (ev.clientY - d.y) / dragPixelsPerDelta)));
    } else if (d.mode === "right") {
      const { dragMinRatio, dragMaxRatio, dragPixelsPerDelta } = UI_PREFERENCES.rightSplit;
      setRightTopRatio(Math.max(dragMinRatio, Math.min(dragMaxRatio, d.rightTopRatio + (ev.clientY - d.y) / dragPixelsPerDelta)));
    } else if (d.mode === "hm") {
      const hm = UI_PREFERENCES.loudnessHistMetrics;
      const base = typeof d.loudnessHistWidthRatio === "number" ? d.loudnessHistWidthRatio : hm.initialRatio;
      setLoudnessHistWidthRatio(
        Math.max(hm.dragMinRatio, Math.min(hm.dragMaxRatio, base + (ev.clientX - d.x) / hm.dragPixelsPerDelta))
      );
    }
  };
  const onLayoutDragUp = (ev) => {
    layoutDragRef.current = null;
    try {
      ev.currentTarget.releasePointerCapture(ev.pointerId);
    } catch (_) {}
  };

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return;
      const s = JSON.parse(raw);
      if (typeof s.mainLeft === "number") setMainLeft(s.mainLeft);
      if (typeof s.leftTopRatio === "number") setLeftTopRatio(s.leftTopRatio);
      if (typeof s.rightTopRatio === "number") setRightTopRatio(s.rightTopRatio);
      if (typeof s.loudnessHistWidthRatio === "number") setLoudnessHistWidthRatio(s.loudnessHistWidthRatio);
      if (s.standard === "ebu" || s.standard === "stream") setStandard(s.standard);
      if (s.uiMode === "dark" || s.uiMode === "light") setUiMode(s.uiMode);
    } catch (_) {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        STORE_KEY,
        JSON.stringify({ mainLeft, leftTopRatio, rightTopRatio, loudnessHistWidthRatio, standard, uiMode })
      );
    } catch (_) {}
  }, [mainLeft, leftTopRatio, rightTopRatio, loudnessHistWidthRatio, standard, uiMode]);

  useEffect(() => {
    applyUiPreferencesToDocument(UI_PREFERENCES, uiMode);
  }, [uiMode]);

  useEffect(() => {
    selectedOffsetRef.current = selectedOffset;
    if (selectedOffset >= 0 && !frozenSnapRef.current) {
      frozenSnapRef.current = {
        loudness: [...loudnessHistRef.current],
        spectrum: [...spectrumSnapRef.current],
        vector: [...vectorSnapRef.current],
        corr: [...corrSnapRef.current],
        audio: [...audioSnapRef.current],
      };
    }
    if (selectedOffset < 0) frozenSnapRef.current = null;
  }, [selectedOffset]);

  useEffect(() => {
    if (!running) {
      if (audioRef.current) {
        try { audioRef.current.stream?.getTracks()?.forEach((t) => t.stop()); } catch (_) {}
        try { audioRef.current.ctx?.close(); } catch (_) {}
      }
      audioRef.current = null;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return;
    }
    let mounted = true;
    const init = async () => {
      try {
        setStatus("Requesting microphone...");
        const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
        if (!mounted) return;
        const ctx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: "interactive" });
        const src = ctx.createMediaStreamSource(stream);
        await ctx.audioWorklet.addModule("/worklets/loudness-meter.js");
        const wklt = new AudioWorkletNode(ctx, "loudness-meter");
        const split = ctx.createChannelSplitter(2);
        const an = ctx.createAnalyser();
        const anL = ctx.createAnalyser();
        const anR = ctx.createAnalyser();
        an.fftSize = 4096;
        anL.fftSize = 2048;
        anR.fftSize = 2048;
        src.connect(wklt);
        src.connect(an);
        src.connect(split);
        split.connect(anL, 0);
        split.connect(anR, 1);
        const bufL = new Float32Array(anL.fftSize);
        const bufR = new Float32Array(anR.fftSize);
        const fbuf = new Float32Array(an.frequencyBinCount);
        wklt.port.onmessage = (e) => {
          const d = e.data || {};
          const m = Number.isFinite(d.momentary) ? d.momentary : -Infinity;
          const st = Number.isFinite(d.shortTerm) ? d.shortTerm : -Infinity;
          const next = [...loudnessHistRef.current, { m, st }];
          if (next.length > HIST_MAX_SAMPLES) next.shift();
          loudnessHistRef.current = next;
          setAudio((prev) => {
            const nextAudio = {
              ...prev,
              momentary: m,
              shortTerm: st,
              integrated: Number.isFinite(d.integrated) ? d.integrated : prev.integrated,
              lra: Number.isFinite(d.lra) ? d.lra : prev.lra,
              truePeakL: Number.isFinite(d.truePeakL) ? d.truePeakL : prev.truePeakL,
              truePeakR: Number.isFinite(d.truePeakR) ? d.truePeakR : prev.truePeakR,
              samplePeak: Number.isFinite(d.truePeak) ? d.truePeak : prev.samplePeak,
              tpMax: Number.isFinite(d.truePeak) ? Math.max(prev.tpMax, d.truePeak) : prev.tpMax,
              mMax: Number.isFinite(m) ? Math.max(prev.mMax, m) : prev.mMax,
              stMax: Number.isFinite(st) ? Math.max(prev.stMax, st) : prev.stMax,
            };
            audioSnapRef.current.push({ ...nextAudio });
            if (audioSnapRef.current.length > HIST_MAX_SAMPLES) audioSnapRef.current.shift();
            return nextAudio;
          });
        };

        const tick = () => {
          if (!mounted) return;
          frameRef.current += 1;
          const shouldPaintUi = frameRef.current % 2 === 0;
          anL.getFloatTimeDomainData(bufL);
          anR.getFloatTimeDomainData(bufR);
          an.getFloatFrequencyData(fbuf);

          let maxL = 0; let maxR = 0; let sumL = 0; let sumR = 0; let sumLR = 0;
          for (let i = 0; i < bufL.length; i++) {
            const l = bufL[i]; const r = bufR[i];
            const al = Math.abs(l); const ar = Math.abs(r);
            if (al > maxL) maxL = al;
            if (ar > maxR) maxR = ar;
            sumL += l * l; sumR += r * r; sumLR += l * r;
          }
          const vecPts = [];
          const invSqrt2 = 0.7071067811865476;
          for (let i = 0; i < bufL.length; i += 6) {
            const l = Math.max(-1, Math.min(1, bufL[i]));
            const r = Math.max(-1, Math.min(1, bufR[i]));
            const side = (r - l) * invSqrt2;
            const mid = (l + r) * invSqrt2;
            const x = 130 + side * 96;
            const y = 130 - mid * 96;
            vecPts.push(`${x.toFixed(2)} ${y.toFixed(2)}`);
          }
          const vp = vecPts.length ? `M ${vecPts.join(" L ")}` : "";
          vectorSnapRef.current.push(vp);
          if (vectorSnapRef.current.length > HIST_MAX_SAMPLES) vectorSnapRef.current.shift();
          if (selectedOffsetRef.current < 0 && shouldPaintUi) setVectorPath(vp);

          const spL = maxL > 0 ? 20 * Math.log10(maxL) : -Infinity;
          const spR = maxR > 0 ? 20 * Math.log10(maxR) : -Infinity;
          const corrDen = Math.sqrt(sumL * sumR);
          const corr = corrDen > 1e-9 ? Math.max(-1, Math.min(1, sumLR / corrDen)) : 0;

          if (shouldPaintUi) {
            setAudio((prev) => ({
              ...prev,
              tpL: spL,
              tpR: spR,
              sampleL: spL,
              sampleR: spR,
              samplePeakMaxL: Number.isFinite(spL) ? Math.max(prev.samplePeakMaxL, spL) : prev.samplePeakMaxL,
              samplePeakMaxR: Number.isFinite(spR) ? Math.max(prev.samplePeakMaxR, spR) : prev.samplePeakMaxR,
              correlation: corr,
            }));
          }
          corrSnapRef.current.push(corr);
          if (corrSnapRef.current.length > HIST_MAX_SAMPLES) corrSnapRef.current.shift();

          const nextHist = loudnessHistRef.current;
          if (nextHist.length > HIST_MAX_SAMPLES) nextHist.shift();
          histRef.current = nextHist;
          if (selectedOffsetRef.current < 0 && shouldPaintUi) {
            setHistoryPathM("");
            setHistoryPathST("");
          }

          // Display-only fix: use log-frequency mapping for x-axis so curve aligns
          // with 20..20k labels; no DSP/worklet calculation logic is changed here.
          const pts = [];
          const nyquist = ctx.sampleRate * 0.5;
          const minF = 20;
          const maxF = Math.min(20000, nyquist);
          const logMin = Math.log10(minF);
          const logMax = Math.log10(maxF);
          const pxCount = 240;
          for (let p = 0; p < pxCount; p++) {
            const t = p / Math.max(1, pxCount - 1);
            const freq = Math.pow(10, logMin + t * (logMax - logMin));
            const bin = (freq / nyquist) * fbuf.length;
            const i0 = Math.max(0, Math.min(fbuf.length - 1, Math.floor(bin)));
            const i1 = Math.max(0, Math.min(fbuf.length - 1, i0 + 1));
            const k = Math.max(0, Math.min(1, bin - i0));
            const d = Math.max(
              -100,
              Math.min(0, fbuf[i0] * (1 - k) + fbuf[i1] * k)
            );
            const x = t * 1000;
            const y = spectrumDbToYViewBox(d);
            pts.push(`${x.toFixed(2)} ${y.toFixed(2)}`);
          }
          const sp = pts.length ? `M ${pts.join(" L ")}` : "";
          spectrumSnapRef.current.push(sp);
          if (spectrumSnapRef.current.length > HIST_MAX_SAMPLES) spectrumSnapRef.current.shift();
          if (selectedOffsetRef.current < 0 && shouldPaintUi) setSpectrumPath(sp);
          rafRef.current = requestAnimationFrame(tick);
        };

        audioRef.current = { ctx, stream, wklt };
        setStatus("Monitoring live input");
        const label = stream.getAudioTracks()[0]?.label || "System default microphone";
        setStatus2(`Input: ${label} | SR: ${Math.round(ctx.sampleRate)} Hz`);
        tick();
      } catch (err) {
        setRunning(false);
        setStatus(`Error: ${err?.message || "Microphone unavailable"}`);
        setStatus2("Input: None");
      }
    };
    init();
    return () => {
      mounted = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (audioRef.current) {
        try { audioRef.current.stream?.getTracks()?.forEach((t) => t.stop()); } catch (_) {}
        try { audioRef.current.ctx?.close(); } catch (_) {}
      }
    };
  }, [running]);

  return (
    <div className="ui-page">
      <div className="ui-shell-inner">
        <header className="ui-header">
          <div className="ui-app-title">
            Audio<span className="ui-app-title-brand">Meter</span>
          </div>
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            <PillButton onClick={clearAll}>Clear</PillButton>
            <PillButton accent onClick={onStartClick}>{startLabel}</PillButton>
            <PillButton onClick={() => setSettingsOpen(true)}>Settings</PillButton>
          </div>
        </header>

        <main
          className="min-h-0 flex-1 gap-[var(--ui-splitter-row)] overflow-y-auto lg:grid lg:overflow-hidden lg:min-h-0 lg:grid-cols-[var(--left)_var(--ui-splitter-main)_1fr] lg:grid-rows-[minmax(0,1fr)]"
          style={{ "--left": `${mainLeft}px` }}
        >
          <section
            className="grid min-h-0 gap-[var(--ui-splitter-row)] lg:h-full lg:min-h-0 lg:grid-rows-[var(--leftTop)_var(--ui-splitter-row)_minmax(0,1fr)]"
            style={{ "--leftTop": `${Math.round(leftTopRatio * 100)}%` }}
          >
            <article className="ui-article ui-min-h-peak min-h-0">
              <div className="mb-3 shrink-0">
                <div className="ui-section-title">Peak Meter</div>
              </div>
              <div className="grid min-h-0 flex-1 grid-cols-[auto_1fr] gap-3 ui-min-h-peak">
                {/* 与表盘 gauge（top-2 bottom-3）同高同偏移，刻度用 peakFromTopFrac 与 peak.js mFrac 一致 */}
                <div className="ui-w-peak-ticks relative min-h-0 h-full shrink-0 overflow-visible text-right text-xs text-[color:var(--ui-color-text-secondary)]">
                  <div className="absolute inset-x-0 top-2 bottom-3">
                    {PEAK_TICKS.map(({ v, lb }) => (
                      <span key={v} className="absolute right-0 -translate-y-1/2 leading-none" style={{ top: `${peakFromTopFrac(v) * 100}%` }}>
                        {lb}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="relative h-full min-h-0 rounded-lg bg-[var(--ui-color-inset-bg)] p-2">
                    <div className="absolute inset-x-3 bottom-3 top-2">
                      <div className="meter-gradient absolute inset-x-0 bottom-0 rounded-md" style={{ top: `${peakFromTopFrac(displayAudio.sampleL) * 100}%` }} />
                      {Number.isFinite(displayAudio.samplePeakMaxL) && (
                        <div
                          className="ui-border-peak-sample pointer-events-none absolute inset-x-0 z-[5] border-t"
                          style={{ top: `${peakFromTopFrac(displayAudio.samplePeakMaxL) * 100}%` }}
                        />
                      )}
                      <div className="ui-border-peak-true absolute inset-x-0 z-[6] border-t" style={{ top: `${peakFromTopFrac(displayAudio.tpL) * 100}%` }} />
                    </div>
                    <div className="absolute left-3 right-3 top-3 text-center text-xs text-[color:var(--ui-color-text-secondary)]">
                      L <span className="tabular-nums text-[color:var(--ui-color-text-muted)]">{fmt(displayAudio.sampleL)}</span>
                    </div>
                  </div>
                  <div className="relative h-full min-h-0 rounded-lg bg-[var(--ui-color-inset-bg)] p-2">
                    <div className="absolute inset-x-3 bottom-3 top-2">
                      <div className="meter-gradient absolute inset-x-0 bottom-0 rounded-md" style={{ top: `${peakFromTopFrac(displayAudio.sampleR) * 100}%` }} />
                      {Number.isFinite(displayAudio.samplePeakMaxR) && (
                        <div
                          className="ui-border-peak-sample pointer-events-none absolute inset-x-0 z-[5] border-t"
                          style={{ top: `${peakFromTopFrac(displayAudio.samplePeakMaxR) * 100}%` }}
                        />
                      )}
                      <div className="ui-border-peak-true absolute inset-x-0 z-[6] border-t" style={{ top: `${peakFromTopFrac(displayAudio.tpR) * 100}%` }} />
                    </div>
                    <div className="absolute left-3 right-3 top-3 text-center text-xs text-[color:var(--ui-color-text-secondary)]">
                      R <span className="tabular-nums text-[color:var(--ui-color-text-muted)]">{fmt(displayAudio.sampleR)}</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="ui-caption mt-2 shrink-0">
                TP MAX <span className="font-semibold text-[color:var(--ui-color-tp-max)]">{fmt(displayAudio.tpMax)} dBTP</span>
              </div>
            </article>

            <div
              className="ui-splitter-v"
              onPointerDown={(e) => beginLayoutDrag("left", e)}
              onPointerMove={onLayoutDragMove}
              onPointerUp={onLayoutDragUp}
              onPointerCancel={onLayoutDragUp}
            />

            <article className="ui-article ui-min-h-spectrum flex-1">
              <div className="ui-section-title mb-3 shrink-0">Vectorscope</div>
              <div
                className={`relative min-h-0 flex-1 rounded-lg bg-[var(--ui-color-inset-bg)] ${selectedOffset >= 0 ? "ring-1 ring-[color:var(--ui-color-snapshot-ring)]" : ""}`}
              >
                {selectedOffset >= 0 && (
                  <div
                    className="absolute right-2 top-2 rounded px-2 py-0.5 text-[length:var(--ui-fs-caption)]"
                    style={{ backgroundColor: "var(--ui-color-snapshot-badge-bg)", color: "var(--ui-color-snapshot-badge-text)" }}
                  >
                    Snapshot View
                  </div>
                )}
                <div className="absolute inset-4 rounded-full border border-[color:var(--ui-color-divider)]" />
                <div className="absolute left-1/2 top-4 bottom-4 w-px -translate-x-1/2 bg-[color:var(--ui-color-divider)]" />
                <div className="absolute top-1/2 left-4 right-4 h-px -translate-y-1/2 bg-[color:var(--ui-color-divider)]" />
                <svg viewBox="0 0 260 260" className="absolute inset-0 h-full w-full p-4">
                  <path
                    d={displayVectorPath || "M 130 130 L 130 130"}
                    fill="none"
                    stroke={selectedOffset >= 0 ? "var(--ui-chart-vectorscope-snap)" : "var(--ui-chart-vectorscope-live)"}
                    strokeWidth={UI_PREFERENCES.charts.vectorscope.strokeWidth}
                    opacity={UI_PREFERENCES.charts.vectorscope.axisOpacity}
                  />
                  <circle
                    cx="130"
                    cy="130"
                    r="2"
                    fill={selectedOffset >= 0 ? "var(--ui-chart-vectorscope-snap)" : "var(--ui-chart-vectorscope-live)"}
                  />
                </svg>
                <span className="ui-caption absolute left-2 top-2">L</span>
                <span className="ui-caption absolute right-2 top-2">R</span>
                <span className="ui-caption absolute left-2 bottom-2">-1</span>
                <span className="ui-caption absolute right-2 bottom-2">+1</span>
                <span className="ui-caption absolute bottom-2 right-12">CORRELATION</span>
                <span className={`ui-caption absolute bottom-2 right-2 font-semibold ${valueClassByCorr(correlation)}`}>{correlation.toFixed(2)}</span>
              </div>
            </article>
          </section>

          <div
            className="ui-splitter-h"
            onPointerDown={(e) => beginLayoutDrag("main", e)}
            onPointerMove={onLayoutDragMove}
            onPointerUp={onLayoutDragUp}
            onPointerCancel={onLayoutDragUp}
          />

          <section
            className="grid min-h-0 gap-[var(--ui-splitter-row)] lg:h-full lg:min-h-0 lg:grid-rows-[var(--rightTop)_var(--ui-splitter-row)_minmax(0,1fr)]"
            style={{ "--rightTop": `${Math.round(rightTopRatio * 100)}%` }}
          >
            <div
              className="grid min-h-0 grid-cols-1 gap-4 xl:h-full xl:min-h-0 xl:grid-cols-[var(--hmSplit)_var(--ui-splitter-hm)_minmax(0,1fr)] xl:gap-[var(--ui-splitter-hm)]"
              style={{ "--hmSplit": `${Math.round(loudnessHistWidthRatio * 100)}%` }}
            >
              <article className="ui-article ui-min-h-history flex h-full min-w-0 flex-1 flex-col">
                <div className="ui-section-title mb-3 shrink-0">Loudness History</div>
                <div className="grid min-h-0 flex-1 grid-cols-[var(--ui-w-loudness-y-axis)_minmax(0,1fr)] gap-2 items-stretch ui-min-h-history">
                  <div className="ui-w-loudness-y-axis flex min-h-0 shrink-0 flex-col text-[length:var(--ui-fs-caption)] text-[color:var(--ui-color-text-muted)]">
                    <div className="relative min-h-0 w-full flex-1">
                      <div className="absolute inset-x-0 top-3 bottom-3">
                        {LOUDNESS_TICKS.map(({ v, lb }) => (
                          <span key={v} className="absolute right-0 -translate-y-1/2 leading-none" style={{ top: `${peakFromTopFrac(v) * 100}%` }}>
                            {lb}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="ui-axis-label-sub shrink-0 pb-0.5 text-center">LUFS</div>
                  </div>
                  <div className="relative flex min-h-0 min-w-0 flex-col">
                    <div
                      className="spectrum-grid ui-inset-chart relative min-h-0 flex-1 rounded-lg bg-[var(--ui-color-inset-bg)]"
                      onContextMenu={(e) => e.preventDefault()}
                      onDoubleClick={() => setSelectedOffset(-1)}
                      onWheel={onHistoryWheel}
                      onPointerDown={onHistoryPointerDown}
                      onPointerMove={onHistoryPointerMove}
                      onPointerUp={onHistoryPointerUp}
                      onPointerCancel={onHistoryPointerUp}
                    >
                      <div className="pointer-events-none absolute inset-3">
                        <div
                          className="absolute left-0 right-0 border-t border-dashed border-[color:var(--ui-color-loudness-target-line)]"
                          style={{ top: `${peakFromTopFrac(targetLufs) * 100}%` }}
                        />
                      </div>
                      <svg viewBox="0 0 600 220" className="h-full w-full p-3">
                        {histCurves.m && (
                          <path
                            d={displayHistoryPathM || historyPathM || "M 0 220 L 600 220"}
                            fill="none"
                            stroke="var(--ui-chart-momentary)"
                            strokeWidth={UI_PREFERENCES.charts.loudnessHistory.momentaryStrokeWidth}
                          />
                        )}
                        {histCurves.st && (
                          <path
                            d={displayHistoryPathST || historyPathST || "M 0 220 L 600 220"}
                            fill="none"
                            stroke="var(--ui-chart-shortterm)"
                            strokeWidth={UI_PREFERENCES.charts.loudnessHistory.shortTermStrokeWidth}
                            opacity={UI_PREFERENCES.charts.loudnessHistory.shortTermOpacity}
                          />
                        )}
                        {selectedOffset >= 0 && showSelLine && (
                          <line
                            x1={selLineX}
                            y1="0"
                            x2={selLineX}
                            y2="220"
                            stroke="var(--ui-chart-selection)"
                            strokeWidth={UI_PREFERENCES.charts.loudnessHistory.selectionStrokeWidth}
                            strokeDasharray="4 4"
                          />
                        )}
                      </svg>
                    </div>
                    <div className="ui-caption mt-2 grid grid-cols-5">{historyTimeTicks.map((tick) => <span key={tick} className="text-center">{tick}</span>)}</div>
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                      <div className="ui-caption-subtle">Window: {Math.round(clampedWindowSec)}s | Offset: {Math.round(effectiveOffsetSec)}s</div>
                      <div className="flex flex-wrap items-center justify-end gap-x-2 gap-y-1.5">
                        <span className="text-[length:var(--ui-fs-small)] text-[color:var(--ui-color-target-label)]">
                          Target <span className="ml-1 font-semibold text-[color:var(--ui-color-target-value)]">{targetLufs} LUFS</span>
                        </span>
                        {historyLegend.map((item) => (
                          <button
                            key={item.key}
                            type="button"
                            onClick={() => toggleCurve(item.key)}
                            className={histCurves[item.key] ? "ui-legend-on" : "ui-legend-off"}
                          >
                            <span className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
                            {item.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </article>

              <div
                className="ui-splitter-hm"
                onPointerDown={(e) => beginLayoutDrag("hm", e)}
                onPointerMove={onLayoutDragMove}
                onPointerUp={onLayoutDragUp}
                onPointerCancel={onLayoutDragUp}
              />

              <article className="ui-article ui-article-metrics flex h-full min-h-0 min-w-0 flex-col xl:min-h-0">
                <div className="ui-section-title mb-2 shrink-0">Loudness Metrics</div>
                <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
                  {primaryMetrics.map((metric) => (
                    <MetricRow key={metric.label} {...metric} />
                  ))}
                  {secondaryMetrics.map((metric) => (
                    <MetricRow key={metric.label} {...metric} />
                  ))}
                </div>
              </article>
            </div>

            <div
              className="ui-splitter-v"
              onPointerDown={(e) => beginLayoutDrag("right", e)}
              onPointerMove={onLayoutDragMove}
              onPointerUp={onLayoutDragUp}
              onPointerCancel={onLayoutDragUp}
            />

            <article className="ui-article ui-min-h-spectrum flex-1">
              <div className="ui-section-title mb-3 shrink-0">Spectrum Analyzer</div>
              <div className="grid min-h-0 flex-1 grid-cols-[var(--ui-w-spectrum-y-axis)_minmax(0,1fr)] gap-2 items-stretch ui-min-h-spectrum">
                <div className="ui-w-spectrum-y-axis flex min-h-0 shrink-0 flex-col text-[length:var(--ui-fs-caption)] text-[color:var(--ui-color-text-muted)]">
                  <div className="relative min-h-0 w-full flex-1">
                    <div className="absolute inset-x-0 top-2 bottom-2">
                      {SPEC_Y_TICKS.map(({ v, lb }) => (
                        <span key={v} className="absolute right-0 -translate-y-1/2 leading-none" style={{ top: `${spectrumDbToTopFrac(v) * 100}%` }}>
                          {lb}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="ui-axis-label-sub shrink-0 pb-1 text-center">dB</div>
                </div>
                <div className="relative flex min-h-0 min-w-0 flex-col">
                  <div
                    className={`spectrum-grid ui-inset-chart-spectrum relative min-h-0 flex-1 rounded-lg bg-[var(--ui-color-inset-bg)] ${selectedOffset >= 0 ? "ring-1 ring-[color:var(--ui-color-snapshot-ring)]" : ""}`}
                  >
                    {selectedOffset >= 0 && (
                      <div
                        className="absolute right-2 top-2 rounded px-2 py-0.5 text-[length:var(--ui-fs-caption)]"
                        style={{ backgroundColor: "var(--ui-color-snapshot-badge-bg)", color: "var(--ui-color-snapshot-badge-text)" }}
                      >
                        Snapshot View
                      </div>
                    )}
                    <svg viewBox="0 0 1000 260" className="h-full w-full p-2">
                      <path
                        d={displaySpectrumPath || "M 0 240 L 1000 240"}
                        fill="none"
                        stroke={selectedOffset >= 0 ? "var(--ui-chart-spectrum-snap)" : "var(--ui-chart-spectrum-live)"}
                        strokeWidth={UI_PREFERENCES.charts.spectrum.strokeWidth}
                      />
                    </svg>
                  </div>
                  <div className="ui-caption relative mt-2 w-full" style={{ height: "var(--ui-spectrum-freq-row-h)" }}>
                    {FREQ_LABELS.map(([f, lb]) => (
                      <span key={f} className="absolute top-0 -translate-x-1/2 whitespace-nowrap" style={{ left: `${freqToXFrac(f) * 100}%` }}>
                        {lb}
                      </span>
                    ))}
                  </div>
                  <div className="ui-caption-subtle mt-1">Hz (log)</div>
                </div>
              </div>
            </article>
          </section>
        </main>

        <footer className="ui-footer">
          <span>{status}</span>
          <span className="h-3 w-px bg-[color:var(--ui-color-divider)]" />
          <span>{status2}</span>
          <span className="h-3 w-px bg-[color:var(--ui-color-divider)]" />
          <span>Loudness standard: {standard === "ebu" ? "EBU R128" : "Streaming"}</span>
        </footer>
      </div>

      {settingsOpen && (
        <div className="ui-settings-overlay">
          <div className="ui-settings-dialog">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="ui-settings-heading">Settings</h2>
              <button type="button" className="ui-settings-btn rounded-full px-3 py-1" onClick={() => setSettingsOpen(false)}>
                Close
              </button>
            </div>
            <div className="flex flex-col gap-4 text-[length:var(--ui-fs-body)]">
              <div className="ui-settings-row">
                <span className="ui-settings-label">Loudness standard</span>
                <select value={standard} onChange={(e) => setStandard(e.target.value)} className="ui-select">
                  <option value="ebu">EBU R128</option>
                  <option value="stream">Streaming</option>
                </select>
              </div>
              <div className="ui-settings-row">
                <span className="ui-settings-label">Theme</span>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setUiMode("dark")} className={uiMode === "dark" ? "ui-theme-btn-on" : "ui-theme-btn-off"}>
                    Dark
                  </button>
                  <button type="button" onClick={() => setUiMode("light")} className={uiMode === "light" ? "ui-theme-btn-on" : "ui-theme-btn-off"}>
                    Light
                  </button>
                </div>
              </div>
              <div className="ui-settings-row">
                <span className="ui-settings-label">Layout</span>
                <button type="button" onClick={resetLayout} className="ui-settings-btn rounded-full px-3 py-1">
                  Reset Layout
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
