import { useEffect, useMemo, useRef, useState } from "react";
import {
  peakFromTopFrac,
  PEAK_DB_MIN,
  PEAK_DB_MAX,
  loudnessHistY,
  loudnessFromTopFrac,
  LOUDNESS_TICKS,
  buildRtaBands,
  SPECTRUM_SETTINGS,
  spectrumDbToTopFrac,
  freqToXFrac,
} from "./scales";
import { UI_PREFERENCES, applyUiPreferencesToDocument, getResolvedCharts, readPersistedUiMode } from "./uiPreferences";
import { buildHistoryPath, getHistoryViewport, HISTORY_MAX_WINDOW_SEC, HISTORY_MIN_WINDOW_SEC } from "./math/historyMath";
import { fmtMetric, fmtSec } from "./math/formatMath";
import { samplePeakLineColor } from "./math/colorMath";
import { useHistoryInteraction } from "./hooks/useHistoryInteraction";
import { useLayoutDrag } from "./hooks/useLayoutDrag";
import { useAudioEngine } from "./hooks/useAudioEngine";
import { PeakPanel } from "./components/panels/PeakPanel";
import { LoudnessPanel } from "./components/panels/LoudnessPanel";
import { SpectrumPanel } from "./components/panels/SpectrumPanel";
import { VectorscopePanel } from "./components/panels/VectorscopePanel";
const HIST_SAMPLE_SEC = 0.1;
const HIST_MAX_SAMPLES = 36000;
const HISTORY_TIME_TICK_STEPS = 4;

function formatHoverOffset(sec) {
  const s = Math.max(0, sec);
  if (s >= 60) {
    const m = Math.floor(s / 60);
    const rem = s - m * 60;
    return `${m}m ${rem.toFixed(rem >= 10 ? 0 : 1)}s ago`;
  }
  return `${s.toFixed(s >= 10 ? 0 : 1)}s ago`;
}

function formatSpectrumFreq(freq) {
  if (!Number.isFinite(freq)) return "-";
  if (freq >= 1000) {
    const khz = freq / 1000;
    return `${khz >= 10 ? khz.toFixed(1) : khz.toFixed(2)} kHz`;
  }
  return `${Math.round(freq)} Hz`;
}

function PillButton({ children, accent = false, liveSnap = false, onClick }) {
  const cls = [
    "ui-pill",
    accent ? "ui-pill-accent" : "ui-pill-default",
    accent && liveSnap ? "ui-pill-live-snap" : "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <button type="button" onClick={onClick} className={cls}>
      {children}
    </button>
  );
}

function MetricRow({ label, value, unit, isActive = false, onToggle }) {
  const { valueColumnCh, unitColumnRem } = UI_PREFERENCES.modules.loudness.metrics;
  const content = (
    <>
      <span className="ui-metric-label">{label}</span>
      <span className="ui-metric-value" style={{ width: `${valueColumnCh}ch` }}>
        {value}
      </span>
      <span className="ui-metric-unit" style={{ width: `${unitColumnRem}rem` }}>
        {unit}
      </span>
    </>
  );

  if (onToggle) {
    return (
      <button type="button" onClick={onToggle} className={isActive ? "ui-metric-row ui-metric-row-toggle on" : "ui-metric-row ui-metric-row-toggle"}>
        {content}
      </button>
    );
  }

  return (
    <div className="ui-metric-row">
      {content}
    </div>
  );
}

export default function App() {
  const buildVersionRaw = import.meta.env.VITE_APP_VERSION || "dev";
  const buildVersion = buildVersionRaw === "dev" ? "dev" : buildVersionRaw.slice(0, 7);
  const STORE_KEY = UI_PREFERENCES.layoutPersistKey;
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [uiMode, setUiMode] = useState(() => readPersistedUiMode());
  const [standard, setStandard] = useState("ebu");
  const [running, setRunning] = useState(false);
  const [selectedOffset, setSelectedOffset] = useState(-1);
  const [historyWindowSec, setHistoryWindowSec] = useState(UI_PREFERENCES.modules.loudness.history.defaultWindowSec);
  const [historyOffsetSec, setHistoryOffsetSec] = useState(0);
  const [historyHudUntilTs, setHistoryHudUntilTs] = useState(0);
  const [historyHudHold, setHistoryHudHold] = useState(false);
  const [status, setStatus] = useState("Ready - click Start to begin monitoring");
  const [status2, setStatus2] = useState("Input: Not connected");
  const [histCurves, setHistCurves] = useState({ m: false, st: true });
  const [audio, setAudio] = useState({
    momentary: -Infinity,
    shortTerm: -Infinity,
    integrated: -Infinity,
    mMax: -Infinity,
    stMax: -Infinity,
    lra: -Infinity,
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
  const [spectrumPeakPath, setSpectrumPeakPath] = useState("");
  const [vectorPath, setVectorPath] = useState("");
  const [historyPathM, setHistoryPathM] = useState("");
  const [historyPathST, setHistoryPathST] = useState("");
  const [historyHover, setHistoryHover] = useState(null);
  const [spectrumHover, setSpectrumHover] = useState(null);
  const [mainLeft, setMainLeft] = useState(UI_PREFERENCES.layout.mainColumn.initialPx);
  const [leftTopRatio, setLeftTopRatio] = useState(UI_PREFERENCES.layout.leftSplit.initialRatio);
  const [rightTopRatio, setRightTopRatio] = useState(UI_PREFERENCES.layout.rightSplit.initialRatio);
  /** Loudness 卡片内 History 与 Metrics 区域的横向宽度比（可持久化） */
  const [loudnessHistWidthRatio, setLoudnessHistWidthRatio] = useState(UI_PREFERENCES.layout.loudnessHistMetrics.initialRatio);
  const audioRef = useRef(null);
  const spectrumStateRef = useRef({ smoothDb: [], peakDb: [], peakHoldUntil: [] });
  const spectrumTimeRef = useRef(0);
  const rafRef = useRef(0);
  const frameRef = useRef(0);
  const histRef = useRef([]);
  const loudnessHistRef = useRef([]);
  const spectrumSnapRef = useRef([]);
  const spectrumDataRef = useRef(null);
  const spectrumDataSnapRef = useRef([]);
  const vectorSnapRef = useRef([]);
  const corrSnapRef = useRef([]);
  const audioSnapRef = useRef([]);
  const selectedOffsetRef = useRef(-1);
  const uiModeRef = useRef(uiMode);
  const frozenSnapRef = useRef(null);

  const historyLegend = useMemo(() => {
    const mode = uiMode === "light" ? "light" : "dark";
    const ch = getResolvedCharts(UI_PREFERENCES, mode);
    const snap = selectedOffset >= 0;
    const lh = ch.loudnessHistory;
    return [
      { key: "m", label: "Momentary", color: snap ? lh.momentaryStrokeSnap : lh.momentaryStroke },
      { key: "st", label: "Short-term", color: snap ? lh.shortTermStrokeSnap : lh.shortTermStroke },
    ];
  }, [uiMode, selectedOffset]);
  const historyTimeTicks = useMemo(() => {
    const ticks = [];
    for (let i = 0; i <= HISTORY_TIME_TICK_STEPS; i++) {
      const sec = Math.round(historyOffsetSec + (historyWindowSec * (HISTORY_TIME_TICK_STEPS - i)) / HISTORY_TIME_TICK_STEPS);
      if (sec >= 60) {
        const m = Math.floor(sec / 60);
        const s = sec % 60;
        ticks.push(`${m}m${s ? `${s}s` : ""}`);
      } else {
        ticks.push(`${sec}s`);
      }
    }
    return ticks;
  }, [historyOffsetSec, historyWindowSec]);
  const fmt = (v) => (Number.isFinite(v) ? v.toFixed(1) : "-");
  const renderPeakFill = (dbValue) => {
    if (!Number.isFinite(dbValue)) return null;
    const clamped = Math.max(PEAK_DB_MIN, Math.min(PEAK_DB_MAX, dbValue));
    const clipTopPct = peakFromTopFrac(clamped) * 100;
    return (
      <div
        className="absolute inset-0 overflow-hidden rounded-md"
        style={{ clipPath: `inset(${clipTopPct}% 0 0 0 round 0.375rem)` }}
      >
        <div className="meter-gradient absolute inset-0" />
      </div>
    );
  };
  const meterGradientCfg = {
    ...UI_PREFERENCES.modules.peak.meterGradient,
    ...(UI_PREFERENCES.themes[uiMode === "light" ? "light" : "dark"]?.meterGradient || {}),
  };
  const getSamplePeakLineColor = (dbValue) =>
    samplePeakLineColor(
      dbValue,
      (v) => peakFromTopFrac(Math.max(PEAK_DB_MIN, Math.min(PEAK_DB_MAX, v))),
      meterGradientCfg
    );
  const toggleCurve = (key) => setHistCurves((prev) => ({ ...prev, [key]: !prev[key] }));
  const targetLufs = standard === "ebu" ? -23 : -14;
  const historyYAxisTicks = useMemo(() => {
    const out = [...LOUDNESS_TICKS];
    if (!out.some((t) => t.v === targetLufs)) out.push({ v: targetLufs, lb: String(targetLufs) });
    out.sort((a, b) => b.v - a.v);
    return out;
  }, [targetLufs]);
  if (selectedOffset < 0) {
    frozenSnapRef.current = null;
  } else if (!frozenSnapRef.current) {
    frozenSnapRef.current = {
      loudness: [...loudnessHistRef.current],
      spectrum: [...spectrumSnapRef.current],
      spectrumData: [...spectrumDataSnapRef.current],
      vector: [...vectorSnapRef.current],
      corr: [...corrSnapRef.current],
      audio: [...audioSnapRef.current],
    };
  }
  const snapSourceHistory = selectedOffset >= 0 && frozenSnapRef.current ? frozenSnapRef.current : null;
  const histSourceList = snapSourceHistory ? snapSourceHistory.loudness : loudnessHistRef.current;
  const snapSource = selectedOffset >= 0 && frozenSnapRef.current ? frozenSnapRef.current : null;
  const snapCorrList = snapSource ? snapSource.corr : corrSnapRef.current;
  const snapSpecList = snapSource ? snapSource.spectrum : spectrumSnapRef.current;
  const snapSpecDataList = snapSource ? snapSource.spectrumData : spectrumDataSnapRef.current;
  const snapVecList = snapSource ? snapSource.vector : vectorSnapRef.current;
  const snapAudioList = snapSource ? snapSource.audio : audioSnapRef.current;
  const selectedHistSteps = selectedOffset >= 0 ? Math.max(0, Math.round(selectedOffset / HIST_SAMPLE_SEC)) : -1;
  const snapIdx = selectedHistSteps >= 0 ? Math.max(0, snapSpecList.length - 1 - selectedHistSteps) : -1;
  const audioSnapIdx = selectedHistSteps >= 0 ? Math.max(0, snapAudioList.length - 1 - selectedHistSteps) : -1;
  const displayAudio = audioSnapIdx >= 0 && snapAudioList[audioSnapIdx] ? snapAudioList[audioSnapIdx] : audio;
  const primaryMetrics = [
    { label: "Momentary", value: fmtMetric(displayAudio.momentary), unit: "LUFS" },
    { label: "Short-term", value: fmtMetric(displayAudio.shortTerm), unit: "LUFS" },
    { label: "Integrated", value: fmtMetric(displayAudio.integrated), unit: "LUFS" },
    { label: "Momentary Max", value: fmtMetric(displayAudio.mMax), unit: "LUFS" },
    { label: "Short-term Max", value: fmtMetric(displayAudio.stMax), unit: "LUFS" },
    { label: "Loudness Range (LRA)", value: fmtMetric(displayAudio.lra), unit: "LU" },
  ];
  const psr = Number.isFinite(displayAudio.tpMax) && Number.isFinite(displayAudio.shortTerm)
    ? displayAudio.tpMax - displayAudio.shortTerm
    : -Infinity;
  const plr = Number.isFinite(displayAudio.tpMax) && Number.isFinite(displayAudio.integrated)
    ? displayAudio.tpMax - displayAudio.integrated
    : -Infinity;
  const secondaryMetrics = [
    { label: "Dynamics (PSR)", value: fmtMetric(psr), unit: "dB" },
    { label: "Avg. Dynamics (PLR)", value: fmtMetric(plr), unit: "dB" },
  ];
  const displaySpectrumPath = snapIdx >= 0 && snapSpecList[snapIdx] ? snapSpecList[snapIdx] : spectrumPath;
  const displaySpectrumPeakPath = selectedOffset >= 0 ? "" : spectrumPeakPath;
  const displaySpectrumData = snapIdx >= 0 && snapSpecDataList[snapIdx] ? snapSpecDataList[snapIdx] : spectrumDataRef.current;
  const displayVectorPath = snapIdx >= 0 && snapVecList[snapIdx] ? snapVecList[snapIdx] : vectorPath;
  const hasHistoryData = histSourceList.some((p) => Number.isFinite(p?.m) || Number.isFinite(p?.st));
  /** Loudness history is a live control only while monitoring or when there is real history to scrub (not cold start). */
  const historyChartInteractive = running || hasHistoryData;
  const vsGridDiagInset = Math.max(0, Math.min(20, UI_PREFERENCES.modules.vector.charts.vectorscope.gridDiagInsetPct ?? 0));
  const vsGridDiagFar = 100 - vsGridDiagInset;
  const correlation = snapIdx >= 0 && Number.isFinite(snapCorrList[snapIdx]) ? snapCorrList[snapIdx] : displayAudio.correlation;
  const hasTpMaxValue = Number.isFinite(displayAudio.tpMax);
  const tpMaxText = hasTpMaxValue ? `${displayAudio.tpMax.toFixed(1)} dBTP` : "-";
  const hasCorrelationValue = Number.isFinite(displayAudio.sampleL) && Number.isFinite(displayAudio.sampleR);
  const startMode = selectedOffset >= 0 ? "live" : running ? "stop" : "start";
  const startLabel = startMode === "live" ? "LIVE" : startMode === "stop" ? "STOP" : "START";
  const totalSamples = histSourceList.length;
  const availableSec = Math.max(0, totalSamples * HIST_SAMPLE_SEC);
  const { clampedWindowSec, visibleSamples, maxOffsetSamples, effectiveOffsetSamples, effectiveOffsetSec } = getHistoryViewport(
    totalSamples,
    historyWindowSec,
    historyOffsetSec,
    HIST_SAMPLE_SEC
  );

  const displayHistoryPathM = buildHistoryPath(
    histSourceList,
    "m",
    visibleSamples,
    effectiveOffsetSamples,
    (v) => loudnessHistY(v, 220)
  );
  const displayHistoryPathST = buildHistoryPath(
    histSourceList,
    "st",
    visibleSamples,
    effectiveOffsetSamples,
    (v) => loudnessHistY(v, 220)
  );
  const showSelLine =
    selectedOffset >= 0 &&
    totalSamples > 0 &&
    selectedHistSteps >= 0 &&
    selectedHistSteps < totalSamples;
  const isHistoryHudVisible = historyChartInteractive && (historyHudHold || historyHudUntilTs > Date.now());
  const selLineX = Math.max(
    0,
    Math.min(
      600,
      600 - ((selectedHistSteps - effectiveOffsetSamples) / Math.max(1, visibleSamples - 1)) * 600
    )
  );
  const onHistoryHoverMove = (clientX, rect) => {
    if (!historyChartInteractive) {
      setHistoryHover(null);
      return;
    }
    if (!histSourceList.length) {
      setHistoryHover(null);
      return;
    }
    const width = Math.max(1, rect.width);
    const x = Math.max(0, Math.min(width, clientX - rect.left));
    const normalized = 1 - x / width;
    const fromEndSamples = effectiveOffsetSamples + normalized * Math.max(0, visibleSamples - 1);
    const hoverIndex = Math.max(0, Math.min(histSourceList.length - 1, histSourceList.length - 1 - Math.round(fromEndSamples)));
    const point = histSourceList[hoverIndex];
    if (!point) {
      setHistoryHover(null);
      return;
    }
    const offsetSec = Math.max(0, (histSourceList.length - 1 - hoverIndex) * HIST_SAMPLE_SEC);
    const yValue = Number.isFinite(point.st) ? point.st : point.m;
    setHistoryHover({
      leftPct: (x / width) * 100,
      topPct: Number.isFinite(yValue) ? loudnessFromTopFrac(yValue) * 100 : null,
      momentary: Number.isFinite(point.m) ? point.m : null,
      shortTerm: Number.isFinite(point.st) ? point.st : null,
      offsetLabel: formatHoverOffset(offsetSec),
    });
  };
  const onHistoryHoverLeave = () => setHistoryHover(null);
  const onSpectrumHoverMove = (clientX, rect) => {
    const data = displaySpectrumData;
    if (!data?.bands?.length || !data?.dbList?.length) {
      setSpectrumHover(null);
      return;
    }
    const width = Math.max(1, rect.width);
    const x = Math.max(0, Math.min(width, clientX - rect.left));
    const xFrac = x / width;
    let nearestIdx = 0;
    let nearestDist = Infinity;
    for (let i = 0; i < data.bands.length; i += 1) {
      const dist = Math.abs(freqToXFrac(data.bands[i].fCenter) - xFrac);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestIdx = i;
      }
    }
    const band = data.bands[nearestIdx];
    const db = data.dbList[nearestIdx];
    if (!band || !Number.isFinite(db)) {
      setSpectrumHover(null);
      return;
    }
    setSpectrumHover({
      leftPct: freqToXFrac(band.fCenter) * 100,
      topPct: spectrumDbToTopFrac(db) * 100,
      freqLabel: formatSpectrumFreq(band.fCenter),
      dbLabel: `${db.toFixed(1)} dB`,
    });
  };
  const onSpectrumHoverLeave = () => setSpectrumHover(null);

  const {
    showHistoryHud,
    holdHistoryHud,
    onHistoryPointerDown,
    onHistoryPointerMove,
    onHistoryPointerUp,
    onHistoryWheel,
  } = useHistoryInteraction({
    enabled: historyChartInteractive,
    sampleSec: HIST_SAMPLE_SEC,
    minWindowSec: HISTORY_MIN_WINDOW_SEC,
    maxWindowSec: HISTORY_MAX_WINDOW_SEC,
    defaultWindowSec: UI_PREFERENCES.modules.loudness.history.defaultWindowSec,
    totalSamples,
    visibleSamples,
    maxOffsetSamples,
    effectiveOffsetSamples,
    effectiveOffsetSec,
    setSelectedOffset,
    setHistoryOffsetSec,
    setHistoryWindowSec,
    setHistoryHudUntilTs,
    setHistoryHudHold,
  });

  const { beginLayoutDrag, onLayoutDragMove, onLayoutDragUp } = useLayoutDrag({
    preferences: UI_PREFERENCES,
    mainLeft,
    leftTopRatio,
    rightTopRatio,
    loudnessHistWidthRatio,
    setMainLeft,
    setLeftTopRatio,
    setRightTopRatio,
    setLoudnessHistWidthRatio,
  });

  const clearAll = () => {
    if (audioRef.current?.wklt) {
      try {
        audioRef.current.wklt.port.postMessage("reset");
      } catch (_) {}
    }
    histRef.current = [];
    loudnessHistRef.current = [];
    spectrumSnapRef.current = [];
    spectrumDataRef.current = null;
    spectrumDataSnapRef.current = [];
    vectorSnapRef.current = [];
    corrSnapRef.current = [];
    audioSnapRef.current = [];
    frozenSnapRef.current = null;
    spectrumStateRef.current = { smoothDb: [], peakDb: [], peakHoldUntil: [] };
    spectrumTimeRef.current = 0;
    setSpectrumPath("");
    setSpectrumPeakPath("");
    setSpectrumHover(null);
    setHistoryHover(null);
    setVectorPath("");
    setHistoryPathM("");
    setHistoryPathST("");
    setAudio({
      momentary: -Infinity, shortTerm: -Infinity, integrated: -Infinity, mMax: -Infinity, stMax: -Infinity, lra: -Infinity,
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
    setHistoryWindowSec(UI_PREFERENCES.modules.loudness.history.defaultWindowSec);
    setStatus(running ? "Running - cleared history and peak hold" : "Ready - click Start to begin monitoring");
  };
  const resetLayout = () => {
    setMainLeft(UI_PREFERENCES.layout.mainColumn.initialPx);
    setLeftTopRatio(UI_PREFERENCES.layout.leftSplit.initialRatio);
    setRightTopRatio(UI_PREFERENCES.layout.rightSplit.initialRatio);
    setLoudnessHistWidthRatio(UI_PREFERENCES.layout.loudnessHistMetrics.initialRatio);
  };
  const onStartClick = () => {
    if (selectedOffset >= 0) return void (setSelectedOffset(-1), setStatus("Monitoring live input"));
    if (running) {
      setRunning(false);
      setSelectedOffset(-1);
      setStatus("Stopped - click Start to resume");
      setStatus2("Input: Not connected");
      return;
    }
    setRunning(true);
  };
  useEffect(() => {
    if (historyHudHold) return;
    const remain = historyHudUntilTs - Date.now();
    if (remain <= 0) return;
    const t = setTimeout(() => setHistoryHudUntilTs(0), remain + 24);
    return () => clearTimeout(t);
  }, [historyHudUntilTs, historyHudHold]);

  useEffect(() => {
    if (historyChartInteractive) return;
    setHistoryHover(null);
    setHistoryHudHold(false);
    setHistoryHudUntilTs(0);
  }, [historyChartInteractive]);

  useEffect(() => {
    if (!settingsOpen) return;
    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setSettingsOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [settingsOpen]);

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
    uiModeRef.current = uiMode;
  }, [uiMode]);

  useEffect(() => {
    applyUiPreferencesToDocument(UI_PREFERENCES, uiMode);
  }, [uiMode]);

  useEffect(() => {
    selectedOffsetRef.current = selectedOffset;
  }, [selectedOffset]);

  /** 与 Loudness History 快照一致：该模式下读数/矢量/频谱来自选中时刻，并非实时输入 */
  useEffect(() => {
    if (!running || selectedOffset < 0) return;
    setStatus("History snapshot (not live input)");
  }, [running, selectedOffset]);

  useAudioEngine({
    running,
    histMaxSamples: HIST_MAX_SAMPLES,
    audioRef,
    spectrumStateRef,
    spectrumTimeRef,
    rafRef,
    frameRef,
    histRef,
    loudnessHistRef,
    spectrumSnapRef,
    spectrumDataRef,
    spectrumDataSnapRef,
    vectorSnapRef,
    corrSnapRef,
    audioSnapRef,
    selectedOffsetRef,
    uiModeRef,
    setAudio,
    setSpectrumPath,
    setSpectrumPeakPath,
    setVectorPath,
    setHistoryPathM,
    setHistoryPathST,
    setStatus,
    setStatus2,
    setRunning,
    setSelectedOffset,
  });

  return (
    <div className="ui-page">
      <div className="ui-shell-inner">
        <header className="ui-header">
          <div className="ui-app-title">
            Audio<span className="ui-app-title-brand">Meter</span>
          </div>
          <div className="flex-1" />
          <div className="flex items-center gap-[var(--ui-header-action-gap)]">
            <PillButton onClick={clearAll}>Clear</PillButton>
            <PillButton accent liveSnap={startMode === "live"} onClick={onStartClick}>
              {startLabel}
            </PillButton>
            <PillButton onClick={() => setSettingsOpen(true)}>Settings</PillButton>
          </div>
        </header>

        <main
          className="min-h-0 flex-1 gap-[var(--ui-section-gap)] overflow-y-auto lg:grid lg:gap-0 lg:overflow-hidden lg:min-h-0 lg:grid-cols-[var(--left)_var(--ui-splitter-main)_1fr] lg:grid-rows-[minmax(0,1fr)]"
          style={{ "--left": `${mainLeft}px` }}
        >
          <section
            className="grid min-h-0 gap-[var(--ui-section-gap)] lg:h-full lg:min-h-0 lg:gap-0 lg:grid-rows-[var(--leftTop)_var(--ui-splitter-row)_minmax(0,1fr)]"
            style={{ "--leftTop": `${Math.round(leftTopRatio * 100)}%` }}
          >
            <PeakPanel
              displayAudio={displayAudio}
              renderPeakFill={renderPeakFill}
              getSamplePeakLineColor={getSamplePeakLineColor}
              fmt={fmt}
              hasTpMaxValue={hasTpMaxValue}
              tpMaxText={tpMaxText}
            />

            <div
              className="ui-splitter-v"
              onPointerDown={(e) => beginLayoutDrag("left", e)}
              onPointerMove={onLayoutDragMove}
              onPointerUp={onLayoutDragUp}
              onPointerCancel={onLayoutDragUp}
            />

            <VectorscopePanel
              vsGridDiagInset={vsGridDiagInset}
              vsGridDiagFar={vsGridDiagFar}
              displayVectorPath={displayVectorPath}
              selectedOffset={selectedOffset}
              hasCorrelationValue={hasCorrelationValue}
              correlation={correlation}
            />
          </section>

          <div
            className="ui-splitter-h"
            onPointerDown={(e) => beginLayoutDrag("main", e)}
            onPointerMove={onLayoutDragMove}
            onPointerUp={onLayoutDragUp}
            onPointerCancel={onLayoutDragUp}
          />

          <section
            className="grid min-h-0 gap-[var(--ui-section-gap)] lg:h-full lg:min-h-0 lg:gap-0 lg:grid-rows-[var(--rightTop)_var(--ui-splitter-row)_minmax(0,1fr)]"
            style={{ "--rightTop": `${Math.round(rightTopRatio * 100)}%` }}
          >
            <LoudnessPanel
              loudnessHistWidthRatio={loudnessHistWidthRatio}
              historyYAxisTicks={historyYAxisTicks}
              targetLufs={targetLufs}
              hasHistoryData={hasHistoryData}
              historyChartInteractive={historyChartInteractive}
              running={running}
              setSelectedOffset={setSelectedOffset}
              setStatus={setStatus}
              holdHistoryHud={holdHistoryHud}
              showHistoryHud={showHistoryHud}
              onHistoryWheel={onHistoryWheel}
              onHistoryPointerDown={onHistoryPointerDown}
              onHistoryPointerMove={onHistoryPointerMove}
              onHistoryPointerUp={onHistoryPointerUp}
              histCurves={histCurves}
              displayHistoryPathM={displayHistoryPathM}
              displayHistoryPathST={displayHistoryPathST}
              selectedOffset={selectedOffset}
              showSelLine={showSelLine}
              selLineX={selLineX}
              isHistoryHudVisible={isHistoryHudVisible}
              clampedWindowSec={clampedWindowSec}
              effectiveOffsetSec={effectiveOffsetSec}
              fmtSec={fmtSec}
              historyHover={historyHover}
              historyTimeTicks={historyTimeTicks}
              historyTickSteps={HISTORY_TIME_TICK_STEPS}
              primaryMetrics={primaryMetrics}
              secondaryMetrics={secondaryMetrics}
              MetricRow={MetricRow}
              toggleCurve={toggleCurve}
              onHistoryHoverMove={onHistoryHoverMove}
              onHistoryHoverLeave={onHistoryHoverLeave}
            />

            <div
              className="ui-splitter-v"
              onPointerDown={(e) => beginLayoutDrag("right", e)}
              onPointerMove={onLayoutDragMove}
              onPointerUp={onLayoutDragUp}
              onPointerCancel={onLayoutDragUp}
            />

            <SpectrumPanel
              displaySpectrumPath={displaySpectrumPath}
              displaySpectrumPeakPath={displaySpectrumPeakPath}
              selectedOffset={selectedOffset}
              spectrumHover={spectrumHover}
              onSpectrumHoverMove={onSpectrumHoverMove}
              onSpectrumHoverLeave={onSpectrumHoverLeave}
            />
          </section>
        </main>

        <footer className="ui-footer">
          <span>{status}</span>
          <span className="h-3 w-px bg-[color:var(--ui-color-divider)]" />
          <span>{status2}</span>
          <span className="h-3 w-px bg-[color:var(--ui-color-divider)]" />
          <span>Loudness standard: {standard === "ebu" ? "EBU R128" : "Streaming"}</span>
          <span className="h-3 w-px bg-[color:var(--ui-color-divider)]" />
          <span>Build: {buildVersion}</span>
        </footer>
      </div>

      {settingsOpen && (
        <div
          className="ui-settings-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSettingsOpen(false);
          }}
        >
          <div className="ui-settings-dialog">
            <div className="ui-settings-header flex items-center justify-between">
              <h2 className="ui-settings-heading">Settings</h2>
              <button type="button" className="ui-settings-btn ui-settings-btn-pill" onClick={() => setSettingsOpen(false)}>
                Close
              </button>
            </div>
            <div className="ui-settings-content flex flex-col text-[length:var(--ui-fs-metric-meta)]">
              <div className="ui-settings-row">
                <span className="ui-settings-label">Loudness standard</span>
                <select value={standard} onChange={(e) => setStandard(e.target.value)} className="ui-select">
                  <option value="ebu">EBU R128</option>
                  <option value="stream">Streaming</option>
                </select>
              </div>
              <div className="ui-settings-row">
                <span className="ui-settings-label">Theme</span>
                <div className="ui-settings-inline-actions flex">
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
                <button type="button" onClick={resetLayout} className="ui-settings-btn ui-settings-btn-pill">
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
