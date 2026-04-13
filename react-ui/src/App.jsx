import { useEffect, useMemo, useRef, useState } from "react";

const peakScale = ["+6", "0", "-6", "-12", "-24", "-48"];
const loudnessYScale = ["-9", "-14", "-18", "-23", "-27", "-36"];
const spectrumYScale = ["0", "-20", "-40", "-60", "-80"];
const spectrumXScale = ["20", "50", "100", "200", "500", "1k", "2k", "5k", "10k", "20k"];
const HIST_SAMPLE_SEC = 0.1;
const HIST_MAX_SAMPLES = 36000;

function PillButton({ children, accent = false, onClick }) {
  const base = "rounded-full px-4 py-2 text-sm font-semibold transition-colors duration-200";
  return (
    <button
      type="button"
      onClick={onClick}
      className={accent ? `${base} bg-blue-500 text-white hover:bg-blue-400` : `${base} bg-transparent text-gray-300 hover:bg-gray-700`}
    >
      {children}
    </button>
  );
}

function MetricCard({ label, value, unit }) {
  return (
    <article className="rounded-xl bg-gray-900/70 p-4">
      <div className="text-3xl font-bold tracking-tight text-white">
        {value}
        <span className="ml-1 text-sm font-medium text-gray-400">{unit}</span>
      </div>
      <div className="mt-2 text-xs text-gray-400">{label}</div>
    </article>
  );
}

function valueClassByCorr(corr) {
  if (corr < -0.2) return "text-red-400";
  if (corr < 0.2) return "text-amber-300";
  return "text-emerald-300";
}

export default function App() {
  const STORE_KEY = "am.react.layout.v1";
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [uiMode, setUiMode] = useState("dark");
  const [standard, setStandard] = useState("ebu");
  const [running, setRunning] = useState(false);
  const [selectedOffset, setSelectedOffset] = useState(-1);
  const [historyWindowSec, setHistoryWindowSec] = useState(120);
  const [historyOffsetSec, setHistoryOffsetSec] = useState(0);
  const [status, setStatus] = useState("Ready - click Start to begin monitoring");
  const [status2, setStatus2] = useState("Input: System default microphone");
  const [histCurves, setHistCurves] = useState({ m: false, st: true, int: false });
  const [audio, setAudio] = useState({
    momentary: -Infinity,
    shortTerm: -Infinity,
    integrated: -Infinity,
    mMax: -Infinity,
    stMax: -Infinity,
    lra: 0,
    tpL: -Infinity,
    tpR: -Infinity,
    tpMax: -Infinity,
    sampleL: -Infinity,
    sampleR: -Infinity,
    samplePeak: -Infinity,
    correlation: 0,
  });
  const [spectrumPath, setSpectrumPath] = useState("");
  const [vectorPath, setVectorPath] = useState("");
  const [historyPathM, setHistoryPathM] = useState("");
  const [historyPathST, setHistoryPathST] = useState("");
  const [mainLeft, setMainLeft] = useState(360);
  const [leftTopRatio, setLeftTopRatio] = useState(0.56);
  const [rightTopRatio, setRightTopRatio] = useState(0.48);
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

  const historyLegend = useMemo(
    () => [
      { key: "m", label: "Momentary", color: "#22d3ee" },
      { key: "st", label: "Short-term", color: "#007AFF" },
      { key: "int", label: "Integrated", color: "#f59e0b" },
    ],
    []
  );
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
  const dbToTop = (v) => {
    const clamped = Math.max(-60, Math.min(3, Number.isFinite(v) ? v : -60));
    const frac = (clamped + 60) / 63;
    return `${Math.round((1 - frac) * 88 + 8)}%`;
  };

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
    { label: "True Peak L", value: fmt(audio.tpL), unit: "dBTP" },
    { label: "True Peak R", value: fmt(audio.tpR), unit: "dBTP" },
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
    const toY = (v) => {
      const clamped = Math.max(-60, Math.min(3, Number.isFinite(v) ? v : -60));
      return 220 - ((clamped + 60) / 63) * 220;
    };
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
      tpL: -Infinity, tpR: -Infinity, tpMax: -Infinity, sampleL: -Infinity, sampleR: -Infinity, samplePeak: -Infinity, correlation: 0,
    });
    setSelectedOffset(-1);
    setHistoryOffsetSec(0);
    setHistoryWindowSec(120);
    setStatus(running ? "Running - cleared history and peak hold" : "Ready - click Start to begin monitoring");
  };
  const resetLayout = () => {
    setMainLeft(360);
    setLeftTopRatio(0.56);
    setRightTopRatio(0.48);
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
  const updateSelectionFromClientX = (clientX, rect) => {
    const width = Math.max(1, rect.width - 34);
    const x = Math.max(0, Math.min(width, clientX - rect.left - 34));
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
        setHistoryWindowSec(120);
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
    const secPerPx = (visibleSamples * HIST_SAMPLE_SEC) / Math.max(1, rect.width - 34);
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
    const baselineSec = Math.max(HIST_SAMPLE_SEC, visibleSamples * HIST_SAMPLE_SEC);
    const next = Math.max(5, Math.min(1800, baselineSec * factor));
    setHistoryWindowSec(next);
    const nextVisibleSamples = Math.max(1, Math.min(Math.max(1, totalSamples), Math.round(next / HIST_SAMPLE_SEC)));
    const nextMaxOffsetSamples = Math.max(0, totalSamples - nextVisibleSamples);
    setHistoryOffsetSec((off) => {
      const offSamples = Math.round(Number(off || 0) / HIST_SAMPLE_SEC);
      return Math.max(0, Math.min(nextMaxOffsetSamples, offSamples)) * HIST_SAMPLE_SEC;
    });
  };
  const beginLayoutDrag = (mode, ev) => {
    layoutDragRef.current = { mode, x: ev.clientX, y: ev.clientY, mainLeft, leftTopRatio, rightTopRatio };
    try {
      ev.currentTarget.setPointerCapture(ev.pointerId);
    } catch (_) {}
  };
  const onLayoutDragMove = (ev) => {
    const d = layoutDragRef.current;
    if (!d) return;
    if (d.mode === "main") {
      setMainLeft(Math.max(280, Math.min(520, d.mainLeft + (ev.clientX - d.x))));
    } else if (d.mode === "left") {
      setLeftTopRatio(Math.max(0.32, Math.min(0.72, d.leftTopRatio + (ev.clientY - d.y) / 500)));
    } else if (d.mode === "right") {
      setRightTopRatio(Math.max(0.34, Math.min(0.76, d.rightTopRatio + (ev.clientY - d.y) / 650)));
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
      if (s.standard === "ebu" || s.standard === "stream") setStandard(s.standard);
      if (s.uiMode === "dark" || s.uiMode === "light") setUiMode(s.uiMode);
    } catch (_) {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        STORE_KEY,
        JSON.stringify({ mainLeft, leftTopRatio, rightTopRatio, standard, uiMode })
      );
    } catch (_) {}
  }, [mainLeft, leftTopRatio, rightTopRatio, standard, uiMode]);

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
              tpL: Number.isFinite(d.truePeakL) ? d.truePeakL : prev.tpL,
              tpR: Number.isFinite(d.truePeakR) ? d.truePeakR : prev.tpR,
              sampleL: Number.isFinite(d.truePeakL) ? d.truePeakL : prev.sampleL,
              sampleR: Number.isFinite(d.truePeakR) ? d.truePeakR : prev.sampleR,
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

          const tpL = maxL > 0 ? 20 * Math.log10(maxL) : -Infinity;
          const tpR = maxR > 0 ? 20 * Math.log10(maxR) : -Infinity;
          const corrDen = Math.sqrt(sumL * sumR);
          const corr = corrDen > 1e-9 ? Math.max(-1, Math.min(1, sumLR / corrDen)) : 0;

          if (shouldPaintUi) {
            setAudio((prev) => ({
              ...prev,
              tpL,
              tpR,
              sampleL: tpL,
              sampleR: tpR,
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
            const y = 260 - ((d + 100) / 100) * 240;
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
    <div className="min-h-screen bg-gray-900 text-gray-100">
      <div className="mx-auto grid max-w-[1600px] grid-rows-[auto_1fr_auto] gap-4 p-4 lg:p-6">
        <header className="flex items-center gap-3 rounded-xl bg-gray-800 px-5 py-4">
          <div className="text-xl font-extrabold tracking-wide text-white">Audio<span className="text-blue-400">Meter</span></div>
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            <PillButton onClick={clearAll}>Clear</PillButton>
            <PillButton accent onClick={onStartClick}>{startLabel}</PillButton>
            <PillButton onClick={() => setSettingsOpen(true)}>Settings</PillButton>
          </div>
        </header>

        <main className="grid gap-2 lg:grid-cols-[var(--left)_8px_1fr]" style={{ "--left": `${mainLeft}px` }}>
          <section className="grid gap-2 lg:grid-rows-[var(--leftTop)_6px_1fr]" style={{ "--leftTop": `${Math.round(leftTopRatio * 100)}%` }}>
            <article className="rounded-xl bg-gray-800 p-4">
              <div className="mb-3 flex items-center justify-between">
                <div className="text-sm text-gray-400">Peak Meter</div>
                <div className="text-xs text-gray-300">TP MAX <span className="ml-1 font-semibold text-cyan-300">{fmt(displayAudio.tpMax)} dBTP</span></div>
              </div>
              <div className="grid h-[320px] grid-cols-[auto_1fr] gap-3">
                <div className="flex flex-col justify-between text-xs text-gray-300">{peakScale.map((tick) => <span key={tick}>{tick}</span>)}</div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="relative rounded-lg bg-gray-900 p-2"><div className="meter-gradient absolute inset-x-3 bottom-3 rounded-md" style={{ top: dbToTop(displayAudio.sampleL) }} /><div className="absolute inset-x-2 border-t border-cyan-200/70" style={{ top: dbToTop(displayAudio.tpL) }} /><div className="absolute left-3 right-3 top-3 text-center text-xs text-gray-300">L</div></div>
                  <div className="relative rounded-lg bg-gray-900 p-2"><div className="meter-gradient absolute inset-x-3 bottom-3 rounded-md" style={{ top: dbToTop(displayAudio.sampleR) }} /><div className="absolute inset-x-2 border-t border-cyan-200/70" style={{ top: dbToTop(displayAudio.tpR) }} /><div className="absolute left-3 right-3 top-3 text-center text-xs text-gray-300">R</div></div>
                </div>
              </div>
              <div className="mt-2 flex justify-between text-[10px] text-gray-400"><span>SP {fmt(displayAudio.samplePeak)} dB</span><span>L {fmt(displayAudio.sampleL)}</span><span>R {fmt(displayAudio.sampleR)}</span></div>
            </article>

            <div
              className="hidden lg:block cursor-row-resize rounded bg-gray-800/80"
              onPointerDown={(e) => beginLayoutDrag("left", e)}
              onPointerMove={onLayoutDragMove}
              onPointerUp={onLayoutDragUp}
              onPointerCancel={onLayoutDragUp}
            />

            <article className="rounded-xl bg-gray-800 p-4">
              <div className="mb-3 text-sm text-gray-400">Vectorscope</div>
              <div className={`relative h-[260px] rounded-lg bg-gray-900 ${selectedOffset >= 0 ? "ring-1 ring-amber-400/50" : ""}`}>
                {selectedOffset >= 0 && (
                  <div className="absolute right-2 top-2 rounded bg-amber-400/15 px-2 py-0.5 text-[10px] text-amber-200">
                    Snapshot View
                  </div>
                )}
                <div className="absolute inset-4 rounded-full border border-gray-700" />
                <div className="absolute left-1/2 top-4 bottom-4 w-px -translate-x-1/2 bg-gray-700" />
                <div className="absolute top-1/2 left-4 right-4 h-px -translate-y-1/2 bg-gray-700" />
                <svg viewBox="0 0 260 260" className="absolute inset-0 h-full w-full p-4">
                  <path
                    d={displayVectorPath || "M 130 130 L 130 130"}
                    fill="none"
                    stroke={selectedOffset >= 0 ? "#f59e0b" : "#22d3ee"}
                    strokeWidth="1.2"
                    opacity="0.8"
                  />
                  <circle cx="130" cy="130" r="2" fill={selectedOffset >= 0 ? "#f59e0b" : "#22d3ee"} />
                </svg>
                <span className="absolute left-2 top-2 text-[10px] text-gray-400">L</span><span className="absolute right-2 top-2 text-[10px] text-gray-400">R</span><span className="absolute left-2 bottom-2 text-[10px] text-gray-400">-1</span><span className="absolute right-2 bottom-2 text-[10px] text-gray-400">+1</span>
                <span className="absolute bottom-2 right-12 text-[10px] text-gray-400">CORRELATION</span><span className={`absolute bottom-2 right-2 text-[10px] font-semibold ${valueClassByCorr(correlation)}`}>{correlation.toFixed(2)}</span>
              </div>
            </article>
          </section>

          <div
            className="hidden lg:block cursor-col-resize rounded bg-gray-800/80"
            onPointerDown={(e) => beginLayoutDrag("main", e)}
            onPointerMove={onLayoutDragMove}
            onPointerUp={onLayoutDragUp}
            onPointerCancel={onLayoutDragUp}
          />

          <section className="grid gap-2 lg:grid-rows-[var(--rightTop)_6px_1fr]" style={{ "--rightTop": `${Math.round(rightTopRatio * 100)}%` }}>
            <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
              <article className="rounded-xl bg-gray-800 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="text-sm text-gray-400">Loudness History</div>
                  <div className="text-xs text-gray-300">Target <span className="ml-1 font-semibold text-amber-300">{targetLufs} LUFS</span></div>
                  <div className="flex items-center gap-2">{historyLegend.map((item) => <button key={item.key} type="button" onClick={() => toggleCurve(item.key)} className={`rounded-full px-3 py-1 text-xs font-medium transition ${histCurves[item.key] ? "bg-gray-700 text-gray-100" : "bg-gray-900 text-gray-400"}`}><span className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />{item.label}</button>)}</div>
                </div>
                <div className="grid h-[260px] grid-cols-[34px_1fr] gap-2" onContextMenu={(e) => e.preventDefault()} onDoubleClick={() => setSelectedOffset(-1)} onWheel={onHistoryWheel} onPointerDown={onHistoryPointerDown} onPointerMove={onHistoryPointerMove} onPointerUp={onHistoryPointerUp} onPointerCancel={onHistoryPointerUp}>
                  <div className="flex flex-col justify-between py-3 text-[10px] text-gray-400">{loudnessYScale.map((tick) => <span key={tick}>{tick}</span>)}<span className="text-[9px] text-gray-500">LUFS</span></div>
                  <div className="relative">
                    <div className="spectrum-grid relative h-[232px] rounded-lg bg-gray-900">
                      <div className="pointer-events-none absolute inset-x-3 border-t border-dashed border-amber-400/70" style={{ top: `${((3 - targetLufs) / 63) * 100}%` }} />
                      <svg viewBox="0 0 600 220" className="h-full w-full p-3">
                        {histCurves.m && <path d={displayHistoryPathM || historyPathM || "M 0 220 L 600 220"} fill="none" stroke="#22d3ee" strokeWidth="2.2" />}
                        {histCurves.st && <path d={displayHistoryPathST || historyPathST || "M 0 220 L 600 220"} fill="none" stroke="#007AFF" strokeWidth="2.6" opacity="0.95" />}
                        {histCurves.int && <path d="M 0 180 C 110 176, 210 170, 300 165 C 410 158, 520 153, 600 150" fill="none" stroke="#f59e0b" strokeWidth="2" strokeDasharray="8 8" />}
                        {selectedOffset >= 0 && showSelLine && <line x1={selLineX} y1="0" x2={selLineX} y2="220" stroke="#f59e0b" strokeWidth="1.2" strokeDasharray="4 4" />}
                      </svg>
                    </div>
                    <div className="mt-2 grid grid-cols-5 text-[10px] text-gray-400">{historyTimeTicks.map((tick) => <span key={tick} className="text-center">{tick}</span>)}</div>
                    <div className="mt-1 text-[10px] text-gray-500">Window: {Math.round(clampedWindowSec)}s | Offset: {Math.round(effectiveOffsetSec)}s</div>
                  </div>
                </div>
              </article>

              <article className="rounded-xl bg-gray-800 p-4">
                <div className="mb-3 text-sm text-gray-400">Loudness Metrics</div>
                <div className="grid grid-cols-2 gap-3">{primaryMetrics.map((metric) => <MetricCard key={metric.label} {...metric} />)}</div>
                <div className="mt-3 grid grid-cols-2 gap-2">{secondaryMetrics.map((metric) => <div key={metric.label} className="rounded-lg bg-gray-900/60 px-3 py-2"><div className="text-lg font-semibold text-gray-100">{metric.value}<span className="ml-1 text-xs font-medium text-gray-400">{metric.unit}</span></div><div className="text-[11px] text-gray-400">{metric.label}</div></div>)}</div>
              </article>
            </div>

            <div
              className="hidden lg:block cursor-row-resize rounded bg-gray-800/80"
              onPointerDown={(e) => beginLayoutDrag("right", e)}
              onPointerMove={onLayoutDragMove}
              onPointerUp={onLayoutDragUp}
              onPointerCancel={onLayoutDragUp}
            />

            <article className="rounded-xl bg-gray-800 p-4">
              <div className="mb-3 text-sm text-gray-400">Spectrum Analyzer</div>
              <div className="grid h-[320px] grid-cols-[36px_1fr] gap-2">
                <div className="flex flex-col justify-between py-2 text-[10px] text-gray-400">{spectrumYScale.map((tick) => <span key={tick}>{tick}</span>)}<span className="text-[9px] text-gray-500">dB</span></div>
                <div className="relative">
                  <div className={`spectrum-grid relative h-[286px] rounded-lg bg-gray-900 ${selectedOffset >= 0 ? "ring-1 ring-amber-400/50" : ""}`}>
                    {selectedOffset >= 0 && (
                      <div className="absolute right-2 top-2 rounded bg-amber-400/15 px-2 py-0.5 text-[10px] text-amber-200">
                        Snapshot View
                      </div>
                    )}
                    <svg viewBox="0 0 1000 260" className="h-full w-full p-2">
                      <path d={displaySpectrumPath || "M 0 240 L 1000 240"} fill="none" stroke={selectedOffset >= 0 ? "#f59e0b" : "#007AFF"} strokeWidth="3" />
                    </svg>
                  </div>
                  <div className="mt-2 grid grid-cols-10 text-[10px] text-gray-400">{spectrumXScale.map((tick) => <span key={tick} className="text-center">{tick}</span>)}</div>
                  <div className="mt-1 text-[10px] text-gray-500">Hz (log)</div>
                </div>
              </div>
            </article>
          </section>
        </main>

        <footer className="flex items-center gap-3 rounded-xl bg-gray-800 px-4 py-2 text-xs text-gray-300">
          <span>{status}</span><span className="h-3 w-px bg-gray-600" /><span>{status2}</span><span className="h-3 w-px bg-gray-600" /><span>Loudness standard: {standard === "ebu" ? "EBU R128" : "Streaming"}</span>
        </footer>
      </div>

      {settingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl bg-gray-800 p-5 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-100">Settings</h2>
              <button type="button" className="rounded-full bg-gray-700 px-3 py-1 text-sm text-gray-200" onClick={() => setSettingsOpen(false)}>Close</button>
            </div>
            <div className="space-y-4 text-sm">
              <div className="flex items-center justify-between rounded-xl bg-gray-900/70 p-3"><span className="text-gray-300">Loudness standard</span><select value={standard} onChange={(e) => setStandard(e.target.value)} className="rounded-lg bg-gray-700 px-2 py-1 text-gray-100"><option value="ebu">EBU R128</option><option value="stream">Streaming</option></select></div>
              <div className="flex items-center justify-between rounded-xl bg-gray-900/70 p-3"><span className="text-gray-300">Theme</span><div className="flex gap-2"><button type="button" onClick={() => setUiMode("dark")} className={`rounded-full px-3 py-1 ${uiMode === "dark" ? "bg-blue-500 text-white" : "bg-gray-700 text-gray-300"}`}>Dark</button><button type="button" onClick={() => setUiMode("light")} className={`rounded-full px-3 py-1 ${uiMode === "light" ? "bg-blue-500 text-white" : "bg-gray-700 text-gray-300"}`}>Light</button></div></div>
              <div className="flex items-center justify-between rounded-xl bg-gray-900/70 p-3"><span className="text-gray-300">Layout</span><button type="button" onClick={resetLayout} className="rounded-full bg-gray-700 px-3 py-1 text-gray-200">Reset Layout</button></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
