import { useEffect } from "react";
import { buildRtaBands, getWeightingDb, SPECTRUM_SETTINGS } from "../scales";
import { dbPathFromBands, smoothByKernel, smoothingPreset } from "../math/spectrumMath";
import { getResolvedCharts, UI_PREFERENCES } from "../uiPreferences";

export function useAudioEngine({
  running,
  histMaxSamples,
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
}) {
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
    /** Mid/Side 包络（L∞），用于 vectorscope 自适应缩放；每帧先衰减再由本帧峰值顶起 */
    let vectorExtentHold = 0.02;
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
        an.fftSize = 16384;
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
          loudnessHistRef.current.push({ m, st });
          if (loudnessHistRef.current.length > histMaxSamples) loudnessHistRef.current.shift();
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
            if (audioSnapRef.current.length > histMaxSamples) audioSnapRef.current.shift();
            return nextAudio;
          });
        };

        let cachedVsMode = null;
        let cachedVsCharts = null;
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
          const currentVsMode = uiModeRef.current === "light" ? "light" : "dark";
          if (currentVsMode !== cachedVsMode) {
            cachedVsMode = currentVsMode;
            cachedVsCharts = getResolvedCharts(UI_PREFERENCES, currentVsMode).vectorscope;
          }
          const vsCharts = cachedVsCharts;
          const basePlotRadius = Math.max(1, Number(vsCharts.plotRadius) || 96);
          const vsHalf = 130;
          const vsSafeInset = 8;
          const vsExtentFloor = 0.02;
          const vsExtentRelease = 0.965;
          let maxCheb = 0;
          for (let i = 0; i < bufL.length; i += 6) {
            const l = Math.max(-1, Math.min(1, bufL[i]));
            const r = Math.max(-1, Math.min(1, bufR[i]));
            const side = (r - l) * invSqrt2;
            const mid = (l + r) * invSqrt2;
            const e = Math.max(Math.abs(side), Math.abs(mid));
            if (e > maxCheb) maxCheb = e;
          }
          vectorExtentHold *= vsExtentRelease;
          if (maxCheb > vectorExtentHold) vectorExtentHold = maxCheb;
          vectorExtentHold = Math.max(vectorExtentHold, vsExtentFloor);
          const effPlotRadius = Math.min(basePlotRadius, (vsHalf - vsSafeInset) / vectorExtentHold);
          for (let i = 0; i < bufL.length; i += 6) {
            const l = Math.max(-1, Math.min(1, bufL[i]));
            const r = Math.max(-1, Math.min(1, bufR[i]));
            const side = (r - l) * invSqrt2;
            const mid = (l + r) * invSqrt2;
            const x = 130 + side * effPlotRadius;
            const y = 130 - mid * effPlotRadius;
            vecPts.push(`${x.toFixed(2)} ${y.toFixed(2)}`);
          }
          const vp = vecPts.length ? `M ${vecPts.join(" L ")}` : "";
          vectorSnapRef.current.push(vp);
          if (vectorSnapRef.current.length > histMaxSamples) vectorSnapRef.current.shift();
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
          if (corrSnapRef.current.length > histMaxSamples) corrSnapRef.current.shift();

          const nextHist = loudnessHistRef.current;
          if (nextHist.length > histMaxSamples) nextHist.shift();
          histRef.current = nextHist;
          if (selectedOffsetRef.current < 0 && shouldPaintUi) {
            setHistoryPathM("");
            setHistoryPathST("");
          }

          const nowSec = ctx.currentTime;
          const deltaSec = spectrumTimeRef.current > 0 ? Math.max(1 / 240, Math.min(0.25, nowSec - spectrumTimeRef.current)) : 1 / 60;
          spectrumTimeRef.current = nowSec;
          const spectrumCfg = SPECTRUM_SETTINGS;
          const nyquist = ctx.sampleRate * 0.5;
          const minF = Math.max(20, spectrumCfg.minHz || 20);
          const maxF = Math.max(minF * 1.2, Math.min(spectrumCfg.maxHz || 20000, nyquist));
          const bands = buildRtaBands(minF, maxF, spectrumCfg.resolution || "1/6");
          if (spectrumCfg.freeze && spectrumStateRef.current.smoothDb.length === bands.length) {
            spectrumDataRef.current = { bands, dbList: [...spectrumStateRef.current.smoothDb] };
            if (selectedOffsetRef.current < 0 && shouldPaintUi) {
              setSpectrumPath(dbPathFromBands(bands, spectrumStateRef.current.smoothDb));
              setSpectrumPeakPath(spectrumCfg.showPeakHold ? dbPathFromBands(bands, spectrumStateRef.current.peakDb) : "");
            }
            rafRef.current = requestAnimationFrame(tick);
            return;
          }
          const weightedDb = [];
          const logMinF = Math.log2(minF);

          for (let b = 0; b < bands.length; b++) {
            const band = bands[b];
            const loBin = Math.max(0, Math.min(fbuf.length - 1, Math.floor((band.fLow / nyquist) * fbuf.length)));
            const hiBin = Math.max(loBin, Math.min(fbuf.length - 1, Math.ceil((band.fHigh / nyquist) * fbuf.length)));
            let powerSum = 0;
            for (let bi = loBin; bi <= hiBin; bi++) {
              const db = Math.max(-160, Math.min(20, fbuf[bi]));
              powerSum += Math.pow(10, db / 10);
            }
            let db = 10 * Math.log10(Math.max(1e-16, powerSum));
            db += getWeightingDb(band.fCenter, spectrumCfg.weighting || "z");
            const oct = Math.log2(Math.max(minF, band.fCenter)) - logMinF;
            db += (spectrumCfg.tiltDbPerOctave || 0) * oct;
            weightedDb.push(db);
          }

          const freqSmoothed = smoothByKernel(weightedDb, spectrumCfg.freqSmoothingKernel || [0.2, 0.6, 0.2]);
          const state = spectrumStateRef.current;
          if (!state.smoothDb.length || state.smoothDb.length !== freqSmoothed.length) {
            state.smoothDb = freqSmoothed.slice();
            state.peakDb = freqSmoothed.slice();
            state.peakHoldUntil = new Array(freqSmoothed.length).fill(nowSec);
          }
          const { attackMs, releaseMs } = smoothingPreset(spectrumCfg.smoothing || "normal");
          const atk = 1 - Math.exp(-deltaSec / Math.max(0.001, attackMs / 1000));
          const rel = 1 - Math.exp(-deltaSec / Math.max(0.001, releaseMs / 1000));
          const peakHoldSec = Math.max(0, (spectrumCfg.peakHoldMs || 0) / 1000);
          const peakDecayPerSec = Math.max(0, spectrumCfg.peakDecayDbPerSec || 0);
          for (let i = 0; i < freqSmoothed.length; i++) {
            const incoming = freqSmoothed[i];
            const prev = state.smoothDb[i];
            const alpha = incoming > prev ? atk : rel;
            const smoothed = prev + (incoming - prev) * alpha;
            state.smoothDb[i] = smoothed;
            if (smoothed >= state.peakDb[i]) {
              state.peakDb[i] = smoothed;
              state.peakHoldUntil[i] = nowSec + peakHoldSec;
            } else if (nowSec > state.peakHoldUntil[i]) {
              state.peakDb[i] = Math.max(smoothed, state.peakDb[i] - peakDecayPerSec * deltaSec);
            }
          }

          const livePath = dbPathFromBands(bands, state.smoothDb);
          const peakPath = dbPathFromBands(bands, state.peakDb);
          const spectrumData = { bands, dbList: [...state.smoothDb] };
          spectrumDataRef.current = spectrumData;
          spectrumSnapRef.current.push(livePath);
          if (spectrumSnapRef.current.length > histMaxSamples) spectrumSnapRef.current.shift();
          spectrumDataSnapRef.current.push(spectrumData);
          if (spectrumDataSnapRef.current.length > histMaxSamples) spectrumDataSnapRef.current.shift();
          if (selectedOffsetRef.current < 0 && shouldPaintUi) {
            setSpectrumPath(livePath);
            setSpectrumPeakPath(spectrumCfg.showPeakHold ? peakPath : "");
          }
          rafRef.current = requestAnimationFrame(tick);
        };

        audioRef.current = { ctx, stream, wklt };
        setStatus("Monitoring live input");
        const label = stream.getAudioTracks()[0]?.label || "System default microphone";
        setStatus2(`Input: ${label}`);
        tick();
      } catch (err) {
        setRunning(false);
        setSelectedOffset(-1);
        setStatus(`Error: ${err?.message || "Microphone unavailable"}`);
        setStatus2("Input: Not connected");
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
}
