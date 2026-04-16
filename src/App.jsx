import { useEffect, useMemo, useRef, useState } from "react";
import {
  peakFromTopFrac,
  PEAK_DB_MIN,
  PEAK_DB_MAX,
  LOUDNESS_DB_MAX,
  LOUDNESS_DB_MIN,
  loudnessFromTopFrac,
  loudnessHistY,
  spectrumDbToTopFrac,
  freqToXFrac,
  PEAK_TICKS,
  LOUDNESS_TICKS,
  SPEC_Y_TICKS,
  FREQ_LABELS,
} from "./scales";
import { UI_PREFERENCES, applyUiPreferencesToDocument, mergeCharts, readPersistedUiMode } from "./uiPreferences";
import { buildHistoryPath, getHistoryViewport, HISTORY_MAX_WINDOW_SEC, HISTORY_MIN_WINDOW_SEC } from "./math/historyMath";
import { fmtMetric, fmtSec } from "./math/formatMath";
import { samplePeakLineColor } from "./math/colorMath";
import { useHistoryInteraction } from "./hooks/useHistoryInteraction";
import { useLayoutDrag } from "./hooks/useLayoutDrag";
import { useAudioEngine } from "./hooks/useAudioEngine";
const HIST_SAMPLE_SEC = 0.1;
const HIST_MAX_SAMPLES = 36000;
const HISTORY_TIME_TICK_STEPS = 4;

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
  const { valueColumnCh, unitColumnRem } = UI_PREFERENCES.loudnessMetrics;
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

function valueClassByCorr(corr) {
  if (corr < -0.2) return "ui-corr-bad";
  if (corr < 0.2) return "ui-corr-mid";
  return "ui-corr-good";
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
  const [historyWindowSec, setHistoryWindowSec] = useState(UI_PREFERENCES.history.defaultWindowSec);
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
  const [mainLeft, setMainLeft] = useState(UI_PREFERENCES.mainColumn.initialPx);
  const [leftTopRatio, setLeftTopRatio] = useState(UI_PREFERENCES.leftSplit.initialRatio);
  const [rightTopRatio, setRightTopRatio] = useState(UI_PREFERENCES.rightSplit.initialRatio);
  /** History ??Metrics ?????????History ???????????????????Metrics??*/
  const [loudnessHistWidthRatio, setLoudnessHistWidthRatio] = useState(UI_PREFERENCES.loudnessHistMetrics.initialRatio);
  const audioRef = useRef(null);
  const spectrumStateRef = useRef({ smoothDb: [], peakDb: [], peakHoldUntil: [] });
  const spectrumTimeRef = useRef(0);
  const rafRef = useRef(0);
  const frameRef = useRef(0);
  const histRef = useRef([]);
  const loudnessHistRef = useRef([]);
  const spectrumSnapRef = useRef([]);
  const vectorSnapRef = useRef([]);
  const corrSnapRef = useRef([]);
  const audioSnapRef = useRef([]);
  const selectedOffsetRef = useRef(-1);
  const uiModeRef = useRef(uiMode);
  const frozenSnapRef = useRef(null);

  const historyLegend = useMemo(() => {
    const mode = uiMode === "light" ? "light" : "dark";
    const ch = mergeCharts(UI_PREFERENCES.charts, UI_PREFERENCES.themes[mode]?.charts);
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
    ...UI_PREFERENCES.meterGradient,
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
  const displayVectorPath = snapIdx >= 0 && snapVecList[snapIdx] ? snapVecList[snapIdx] : vectorPath;
  const hasHistoryData = histSourceList.some((p) => Number.isFinite(p?.m) || Number.isFinite(p?.st));
  const vsGridDiagInset = Math.max(0, Math.min(20, UI_PREFERENCES.charts.vectorscope.gridDiagInsetPct ?? 0));
  const vsGridDiagFar = 100 - vsGridDiagInset;
  const correlation = snapIdx >= 0 && Number.isFinite(snapCorrList[snapIdx]) ? snapCorrList[snapIdx] : displayAudio.correlation;
  const hasTpMaxValue = Number.isFinite(displayAudio.tpMax);
  const tpMaxText = hasTpMaxValue ? `${displayAudio.tpMax.toFixed(1)} dBTP` : "-";
  const hasCorrelationValue = Number.isFinite(displayAudio.sampleL) && Number.isFinite(displayAudio.sampleR);
  const startMode = selectedOffset >= 0 ? "live" : running ? "stop" : "start";
  const startLabel = startMode === "live" ? "LIVE" : startMode === "stop" ? "STOP" : "START";
  const totalSamples = histSourceList.length;
  const availableSec = Math.max(0, totalSamples * HIST_SAMPLE_SEC);
  const { visibleSamples, maxOffsetSamples, effectiveOffsetSamples, effectiveOffsetSec } = getHistoryViewport(
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
  const isHistoryHudVisible = historyHudHold || historyHudUntilTs > Date.now();
  const selLineX = Math.max(
    0,
    Math.min(
      600,
      600 - ((selectedHistSteps - effectiveOffsetSamples) / Math.max(1, visibleSamples - 1)) * 600
    )
  );

  const {
    showHistoryHud,
    holdHistoryHud,
    onHistoryPointerDown,
    onHistoryPointerMove,
    onHistoryPointerUp,
    onHistoryWheel,
  } = useHistoryInteraction({
    sampleSec: HIST_SAMPLE_SEC,
    minWindowSec: HISTORY_MIN_WINDOW_SEC,
    maxWindowSec: HISTORY_MAX_WINDOW_SEC,
    defaultWindowSec: UI_PREFERENCES.history.defaultWindowSec,
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
    vectorSnapRef.current = [];
    corrSnapRef.current = [];
    audioSnapRef.current = [];
    frozenSnapRef.current = null;
    spectrumStateRef.current = { smoothDb: [], peakDb: [], peakHoldUntil: [] };
    spectrumTimeRef.current = 0;
    setSpectrumPath("");
    setSpectrumPeakPath("");
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
            <article className="ui-article ui-min-h-peak min-h-0">
              <div className="shrink-0">
                <div className="ui-section-title ui-section-title-main shrink-0">Peak Meter</div>
              </div>
              <div className="grid min-h-0 flex-1 grid-cols-[auto_1fr] gap-[var(--ui-peak-axis-chart-gap)] ui-min-h-peak">
                {/* ??????gauge??top-2 bottom-3?????????????????peakFromTopFrac ??peak.js mFrac ????*/}
                <div className="ui-w-peak-ticks relative min-h-0 h-full shrink-0 overflow-visible text-right text-[length:var(--ui-fs-axis-value)] text-[color:var(--ui-color-text-muted)]">
                  <div className="absolute inset-x-0 top-[var(--ui-peak-display-top-inset)] bottom-[var(--ui-peak-display-bottom-inset)]">
                    {PEAK_TICKS.map(({ v, lb }) => (
                      <span key={v} className="absolute right-0 -translate-y-1/2 leading-none" style={{ top: `${peakFromTopFrac(v) * 100}%` }}>
                        {lb}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-[var(--ui-peak-channel-gap)]">
                  <div className="relative h-full min-h-0 rounded-lg bg-[var(--ui-color-inset-bg)] p-0">
                    <div className="absolute inset-x-[var(--ui-meter-chart-inset-x)] bottom-[var(--ui-peak-display-bottom-inset)] top-[var(--ui-peak-display-top-inset)]">
                      {renderPeakFill(displayAudio.sampleL)}
                      {Number.isFinite(displayAudio.samplePeakMaxL) && (
                        <div
                          className="pointer-events-none absolute inset-x-0 z-[5] border-t"
                          style={{
                            top: `${peakFromTopFrac(displayAudio.samplePeakMaxL) * 100}%`,
                            borderTopColor: getSamplePeakLineColor(displayAudio.samplePeakMaxL),
                          }}
                        />
                      )}
                    </div>
                    <div className="absolute left-[var(--ui-meter-label-left-inset)] right-0 top-[var(--ui-meter-label-top-inset)] text-left text-[length:var(--ui-fs-extra)] text-[color:var(--ui-color-text-secondary)]">
                      L <span className="tabular-nums text-[color:var(--ui-color-text-muted)]">{fmt(displayAudio.sampleL)}</span>
                    </div>
                  </div>
                  <div className="relative h-full min-h-0 rounded-lg bg-[var(--ui-color-inset-bg)] p-0">
                    <div className="absolute inset-x-[var(--ui-meter-chart-inset-x)] bottom-[var(--ui-peak-display-bottom-inset)] top-[var(--ui-peak-display-top-inset)]">
                      {renderPeakFill(displayAudio.sampleR)}
                      {Number.isFinite(displayAudio.samplePeakMaxR) && (
                        <div
                          className="pointer-events-none absolute inset-x-0 z-[5] border-t"
                          style={{
                            top: `${peakFromTopFrac(displayAudio.samplePeakMaxR) * 100}%`,
                            borderTopColor: getSamplePeakLineColor(displayAudio.samplePeakMaxR),
                          }}
                        />
                      )}
                    </div>
                    <div className="absolute left-[var(--ui-meter-label-left-inset)] right-0 top-[var(--ui-meter-label-top-inset)] text-left text-[length:var(--ui-fs-extra)] text-[color:var(--ui-color-text-secondary)]">
                      R <span className="tabular-nums text-[color:var(--ui-color-text-muted)]">{fmt(displayAudio.sampleR)}</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="mt-[var(--ui-panel-footer-gap)] flex shrink-0 items-baseline justify-start text-[length:var(--ui-fs-extra)]">
                <div className="shrink-0" style={{ width: "var(--ui-tp-info-left-blank)" }} />
                <div className="flex items-baseline gap-[var(--ui-inline-value-gap)]">
                  <span className="text-[color:var(--ui-color-text-muted)]">TP MAX</span>
                  <span className={hasTpMaxValue ? "font-semibold text-[color:var(--ui-color-tp-max)]" : "font-semibold text-[color:var(--ui-color-text-muted)]"}>
                    {tpMaxText}
                  </span>
                </div>
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
              <div className="ui-section-title ui-section-title-main shrink-0">Vectorscope</div>
              <div className="relative min-h-0 flex-1 rounded-lg bg-[var(--ui-color-inset-bg)]">
                <div className="absolute inset-[var(--ui-chart-outer-inset)] z-0 min-h-0 min-w-0 overflow-hidden">
                  <svg
                    className="pointer-events-none absolute inset-0 z-0 block h-full w-full"
                    viewBox="0 0 100 100"
                    preserveAspectRatio="none"
                    aria-hidden
                  >
                    <line
                      x1={vsGridDiagInset}
                      y1={vsGridDiagInset}
                      x2={vsGridDiagFar}
                      y2={vsGridDiagFar}
                      stroke="var(--ui-color-divider)"
                      strokeWidth="0.35"
                      vectorEffect="non-scaling-stroke"
                    />
                    <line
                      x1={vsGridDiagFar}
                      y1={vsGridDiagInset}
                      x2={vsGridDiagInset}
                      y2={vsGridDiagFar}
                      stroke="var(--ui-color-divider)"
                      strokeWidth="0.35"
                      vectorEffect="non-scaling-stroke"
                    />
                  </svg>
                  <svg
                    viewBox="0 0 260 260"
                    preserveAspectRatio="none"
                    className="absolute inset-0 z-[1] block h-full w-full"
                  >
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
                </div>
                <span className="ui-caption absolute left-[var(--ui-vector-corner-inset)] top-[var(--ui-vector-corner-inset)]">L</span>
                <span className="ui-caption absolute right-[var(--ui-vector-corner-inset)] top-[var(--ui-vector-corner-inset)]">R</span>
                <span className="ui-caption absolute left-[var(--ui-vector-corner-inset)] bottom-[var(--ui-vector-corner-inset)]">-1</span>
                <span className="ui-caption absolute right-[var(--ui-vector-corner-inset)] bottom-[var(--ui-vector-corner-inset)]">+1</span>
              </div>
              <div className="mt-[var(--ui-panel-footer-gap)] flex shrink-0 items-baseline justify-start text-[length:var(--ui-fs-extra)]">
                <div className="shrink-0" style={{ width: "var(--ui-corr-info-left-blank)" }} />
                <div className="flex items-baseline gap-[var(--ui-inline-value-gap)]">
                  <span className="text-[color:var(--ui-color-text-muted)]">CORRELATION</span>
                  <span className={hasCorrelationValue ? "font-semibold tabular-nums text-[color:var(--ui-color-tp-max)]" : "font-semibold text-[color:var(--ui-color-text-muted)]"}>{hasCorrelationValue ? correlation.toFixed(2) : "-"}</span>
                </div>
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
            className="grid min-h-0 gap-[var(--ui-section-gap)] lg:h-full lg:min-h-0 lg:gap-0 lg:grid-rows-[var(--rightTop)_var(--ui-splitter-row)_minmax(0,1fr)]"
            style={{ "--rightTop": `${Math.round(rightTopRatio * 100)}%` }}
          >
            <div
              className="grid h-full min-h-0 grid-cols-[var(--hmSplit)_var(--ui-splitter-hm)_minmax(0,1fr)] gap-0"
              style={{ "--hmSplit": `${Math.round(loudnessHistWidthRatio * 100)}%` }}
            >
              <article className="ui-article ui-min-h-history flex h-full min-w-0 flex-1 flex-col">
                <div className="ui-section-title ui-section-title-main shrink-0">Loudness History</div>
                <div className="grid min-h-0 flex-1 grid-cols-[var(--ui-w-loudness-y-axis)_minmax(0,1fr)] grid-rows-[minmax(0,1fr)_var(--ui-chart-x-axis-row-h)_auto] gap-x-[var(--ui-axis-gap-y)] gap-y-[var(--ui-axis-gap-x)] items-stretch ui-min-h-history">
                  <div className="ui-w-loudness-y-axis relative min-h-0 shrink-0 text-[length:var(--ui-fs-axis-value)] text-[color:var(--ui-color-text-muted)]">
                    <div className="absolute inset-x-0 top-[var(--ui-history-display-top-inset)] bottom-[var(--ui-history-display-bottom-inset)]">
                      {historyYAxisTicks.map(({ v, lb }) => {
                        if (v === targetLufs && !hasHistoryData) return null;
                        const isTargetTick = v === targetLufs;
                        const tickClass = isTargetTick
                          ? "absolute right-0 leading-none font-semibold text-[color:var(--ui-color-target-value)]"
                          : "absolute right-0 leading-none";
                        if (v === LOUDNESS_DB_MAX) {
                          return (
                            <span key={v} className={`${tickClass} top-0`}>
                              {lb}
                            </span>
                          );
                        }
                        if (v === LOUDNESS_DB_MIN) {
                          return (
                            <span key={v} className={`${tickClass} bottom-0`}>
                              {lb}
                            </span>
                          );
                        }
                        return (
                          <span key={v} className={`${tickClass} -translate-y-1/2`} style={{ top: `${loudnessFromTopFrac(v) * 100}%` }}>
                            {lb}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                  <div
                    className="spectrum-grid ui-inset-chart relative min-h-0 min-w-0 rounded-lg bg-[var(--ui-color-inset-bg)]"
                    onContextMenu={(e) => e.preventDefault()}
                      onDoubleClick={() => {
                        setSelectedOffset(-1);
                        if (running) setStatus("Monitoring live input");
                        holdHistoryHud(false);
                        showHistoryHud(1200);
                      }}
                    onWheel={onHistoryWheel}
                    onPointerDown={onHistoryPointerDown}
                    onPointerMove={onHistoryPointerMove}
                    onPointerUp={onHistoryPointerUp}
                    onPointerCancel={onHistoryPointerUp}
                  >
                    <svg
                      viewBox="0 0 600 220"
                      preserveAspectRatio="none"
                      className="relative z-0 h-full w-full px-[var(--ui-history-svg-pad)] pt-[var(--ui-history-display-top-inset)] pb-[var(--ui-history-display-bottom-inset)]"
                    >
                      {histCurves.m && displayHistoryPathM && (
                        <path
                          d={displayHistoryPathM}
                          fill="none"
                          stroke={selectedOffset >= 0 ? "var(--ui-chart-momentary-snap)" : "var(--ui-chart-momentary)"}
                          strokeWidth={UI_PREFERENCES.charts.loudnessHistory.momentaryStrokeWidth}
                        />
                      )}
                      {histCurves.st && displayHistoryPathST && (
                        <path
                          d={displayHistoryPathST}
                          fill="none"
                          stroke={selectedOffset >= 0 ? "var(--ui-chart-shortterm-snap)" : "var(--ui-chart-shortterm)"}
                          strokeWidth={UI_PREFERENCES.charts.loudnessHistory.shortTermStrokeWidth}
                          opacity={UI_PREFERENCES.charts.loudnessHistory.shortTermOpacity}
                        />
                      )}
                    </svg>
                    <div className="pointer-events-none absolute inset-x-[var(--ui-history-svg-pad)] top-[var(--ui-history-display-top-inset)] bottom-[var(--ui-history-display-bottom-inset)] z-10">
                      {hasHistoryData ? (
                        <div
                          className="absolute left-0 right-0 border-t border-dashed border-[color:var(--ui-color-loudness-target-line)]"
                          style={{ top: `${loudnessFromTopFrac(targetLufs) * 100}%` }}
                        />
                      ) : null}
                      {selectedOffset >= 0 && showSelLine && (
                        <div
                          className="absolute bottom-0 top-0 border-l border-dashed border-[color:var(--ui-chart-selection)]"
                          style={{
                            left: `${(selLineX / 600) * 100}%`,
                            width: 0,
                            borderLeftWidth: `${UI_PREFERENCES.charts.loudnessHistory.selectionStrokeWidth}px`,
                          }}
                        />
                      )}
                      {isHistoryHudVisible && (
                        <div className="absolute bottom-[var(--ui-hud-inset)] right-[var(--ui-hud-inset)] rounded border border-[color:var(--ui-color-divider)] bg-[color:var(--ui-color-panel-bg-splitter)] px-2 py-0.5 text-[length:var(--ui-fs-axis-value)] text-[color:var(--ui-color-text-secondary)]">
                          Window {fmtSec(clampedWindowSec)} | Offset {fmtSec(effectiveOffsetSec)}
                        </div>
                      )}
                    </div>
                  </div>

                  <div />
                  <div className="ui-caption relative h-[var(--ui-chart-x-axis-row-h)]">
                    <div className="absolute inset-x-[var(--ui-history-svg-pad)] top-0 h-full">
                      {historyTimeTicks.map((tick, i) => {
                        if (i === 0) {
                          return <span key={`${i}-${tick}`} className="absolute left-0 top-0 text-left">{tick}</span>;
                        }
                        if (i === HISTORY_TIME_TICK_STEPS) {
                          return <span key={`${i}-${tick}`} className="absolute right-0 top-0 text-right">{tick}</span>;
                        }
                        return (
                          <span
                            key={`${i}-${tick}`}
                            className="absolute top-0 -translate-x-1/2 text-center"
                            style={{ left: `${(i / HISTORY_TIME_TICK_STEPS) * 100}%` }}
                          >
                            {tick}
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  <div className="h-0 shrink-0" />
                  <div />
                </div>
              </article>

              <div
                className="ui-splitter-hm"
                onPointerDown={(e) => beginLayoutDrag("hm", e)}
                onPointerMove={onLayoutDragMove}
                onPointerUp={onLayoutDragUp}
                onPointerCancel={onLayoutDragUp}
              />

              <article className="ui-article ui-article-metrics flex h-full min-h-0 min-w-0 flex-col">
                <div className="ui-section-title ui-section-title-metrics shrink-0">Loudness Metrics</div>
                <div className="ui-metrics-list flex min-h-0 flex-1 flex-col gap-[var(--ui-metrics-list-gap)] overflow-y-auto">
                  {primaryMetrics.map((metric) => {
                    if (metric.label === "Momentary") {
                      return (
                        <MetricRow
                          key={metric.label}
                          {...metric}
                          isActive={histCurves.m}
                          onToggle={() => toggleCurve("m")}
                        />
                      );
                    }
                    if (metric.label === "Short-term") {
                      return (
                        <MetricRow
                          key={metric.label}
                          {...metric}
                          isActive={histCurves.st}
                          onToggle={() => toggleCurve("st")}
                        />
                      );
                    }
                    return <MetricRow key={metric.label} {...metric} />;
                  })}
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
              <div className="ui-section-title ui-section-title-main shrink-0">Spectrum Analyzer</div>
              <div className="grid min-h-0 flex-1 grid-cols-[var(--ui-w-spectrum-y-axis)_minmax(0,1fr)] grid-rows-[minmax(0,1fr)_var(--ui-chart-x-axis-row-h)_auto] gap-x-[var(--ui-axis-gap-y)] gap-y-[var(--ui-axis-gap-x)] items-stretch ui-min-h-spectrum">
                <div className="ui-w-spectrum-y-axis relative min-h-0 shrink-0 text-[length:var(--ui-fs-axis-value)] text-[color:var(--ui-color-text-muted)]">
                  <div className="absolute inset-x-0 top-[var(--ui-spectrum-display-top-inset)] bottom-[var(--ui-spectrum-display-bottom-inset)]">
                    {SPEC_Y_TICKS.map(({ v, lb }) => (
                      <span key={v} className="absolute right-0 -translate-y-1/2 leading-none" style={{ top: `${spectrumDbToTopFrac(v) * 100}%` }}>
                        {lb}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="relative min-h-0 min-w-0">
                  <div className="spectrum-grid ui-inset-chart-spectrum relative min-h-0 h-full rounded-lg bg-[var(--ui-color-inset-bg)]">
                    <div className="absolute inset-0 min-h-0 min-w-0 px-[var(--ui-spectrum-svg-pad)] pt-[var(--ui-spectrum-display-top-inset)] pb-[var(--ui-spectrum-display-bottom-inset)]">
                      <svg
                        viewBox="0 0 1000 260"
                        preserveAspectRatio="none"
                        className="block h-full w-full min-h-0 min-w-0"
                      >
                        {displaySpectrumPath ? (
                          <>
                            <path
                              d={displaySpectrumPath}
                              fill="none"
                              stroke={selectedOffset >= 0 ? "var(--ui-chart-spectrum-snap)" : "var(--ui-chart-spectrum-live)"}
                              strokeWidth={UI_PREFERENCES.charts.spectrum.strokeWidth}
                            />
                            {displaySpectrumPeakPath ? (
                              <path
                                d={displaySpectrumPeakPath}
                                fill="none"
                                stroke="var(--ui-chart-spectrum-snap)"
                                strokeWidth={Math.max(1, UI_PREFERENCES.charts.spectrum.strokeWidth - 1)}
                                strokeDasharray="8 6"
                                opacity="0.8"
                              />
                            ) : null}
                          </>
                        ) : null}
                      </svg>
                    </div>
                  </div>
                </div>

                <div />
                <div className="ui-caption relative h-[var(--ui-chart-x-axis-row-h)] w-full">
                  <div className="absolute inset-x-[var(--ui-spectrum-svg-pad)] top-0 h-full">
                    {FREQ_LABELS.map(([f, lb]) => (
                      <span key={f} className="absolute top-0 -translate-x-1/2 whitespace-nowrap" style={{ left: `${freqToXFrac(f) * 100}%` }}>
                        {lb}
                      </span>
                    ))}
                  </div>
                </div>

                <div />
                <div />
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
