import { useEffect } from "react";
import { buildRtaBands, SPECTRUM_SETTINGS } from "../scales";
import { listAudioDevices, startAudioCapture, stopAudioCapture } from "../ipc/commands.js";
import { onLoudnessSlow } from "../ipc/events.js";
import { isTauri } from "../ipc/env.js";

export function useAudioEngine({
  running,
  captureDeviceId = "default",
  histMaxSamples,
  audioRef,
  spectrumStateRef: _spectrumStateRef,
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
  uiModeRef: _uiModeRef,
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
      if (audioRef.current?.mode === "tauri") {
        void stopAudioCapture();
        for (const u of audioRef.current?.unsubs || []) {
          try {
            u();
          } catch (_) {}
        }
      }
      if (audioRef.current) {
        try {
          audioRef.current.stream?.getTracks()?.forEach((t) => t.stop());
        } catch (_) {}
        try {
          audioRef.current.ctx?.close();
        } catch (_) {}
      }
      audioRef.current = null;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return;
    }
    let mounted = true;

    const init = async () => {
      try {
        if (isTauri()) {
          setStatus("Starting system audio capture…");
          const devices = await listAudioDevices();
          if (!mounted) return;
          if (!devices?.length) {
            throw new Error("No input devices reported by the native engine");
          }
          const resolvePick = () => {
            if (captureDeviceId && captureDeviceId !== "default") {
              const d = devices.find((x) => x.id === captureDeviceId);
              if (d) return d;
            }
            return (
              devices.find((d) => d.isSystemOutputMonitor) ||
              devices.find((d) => d.isLoopback) ||
              devices[0]
            );
          };
          const pick = resolvePick();
          const unsubs = [];
          const uSlow = await onLoudnessSlow((p) => {
            if (!mounted) return;
            setAudio((prev) => ({
              ...prev,
              integrated:
                p.lufsIntegrated != null && Number.isFinite(p.lufsIntegrated) ? p.lufsIntegrated : prev.integrated,
              mMax: Number.isFinite(p.lufsMMax) ? p.lufsMMax : prev.mMax,
              stMax: Number.isFinite(p.lufsStMax) ? p.lufsStMax : prev.stMax,
              lra: Number.isFinite(p.lra) ? p.lra : prev.lra,
            }));
          });
          unsubs.push(uSlow);

          const statusMain = pick.isSystemOutputMonitor
            ? "Monitoring system playback (loopback)"
            : "Monitoring audio input";

          const applyFrame = (f) => {
            if (!mounted) return;
            frameRef.current += 1;
            const shouldPaintUi = frameRef.current % 2 === 0;
            const m = Number.isFinite(f.lufsMomentary) ? f.lufsMomentary : -Infinity;
            const st = Number.isFinite(f.lufsShortTerm) ? f.lufsShortTerm : -Infinity;
            const histTick = f.loudnessHistTick;

            setAudio((prev) => {
              const nextAudio = {
                ...prev,
                momentary: m,
                shortTerm: st,
                integrated: Number.isFinite(f.integrated) ? f.integrated : prev.integrated,
                lra: Number.isFinite(f.lra) ? f.lra : prev.lra,
                truePeakL: Number.isFinite(f.truePeakL) ? f.truePeakL : prev.truePeakL,
                truePeakR: Number.isFinite(f.truePeakR) ? f.truePeakR : prev.truePeakR,
                samplePeak: Number.isFinite(f.truePeakMaxDbtp) ? f.truePeakMaxDbtp : prev.samplePeak,
                tpMax: Number.isFinite(f.truePeakMaxDbtp) ? f.truePeakMaxDbtp : prev.tpMax,
                tpL: Number.isFinite(f.sampleLDb) ? f.sampleLDb : prev.tpL,
                tpR: Number.isFinite(f.sampleRDb) ? f.sampleRDb : prev.tpR,
                sampleL: Number.isFinite(f.sampleLDb) ? f.sampleLDb : prev.sampleL,
                sampleR: Number.isFinite(f.sampleRDb) ? f.sampleRDb : prev.sampleR,
                samplePeakMaxL: Number.isFinite(f.sampleLDb) ? Math.max(prev.samplePeakMaxL, f.sampleLDb) : prev.samplePeakMaxL,
                samplePeakMaxR: Number.isFinite(f.sampleRDb) ? Math.max(prev.samplePeakMaxR, f.sampleRDb) : prev.samplePeakMaxR,
                correlation: Number.isFinite(f.correlation) ? f.correlation : prev.correlation,
              };
              if (histTick != null) {
                const hm = Number.isFinite(histTick.lufsMomentary) ? histTick.lufsMomentary : -Infinity;
                const hst = Number.isFinite(histTick.lufsShortTerm) ? histTick.lufsShortTerm : -Infinity;
                loudnessHistRef.current.push({ m: hm, st: hst });
                if (loudnessHistRef.current.length > histMaxSamples) loudnessHistRef.current.shift();
                audioSnapRef.current.push({ ...nextAudio });
                if (audioSnapRef.current.length > histMaxSamples) audioSnapRef.current.shift();
              }
              return nextAudio;
            });

            const corr = Number.isFinite(f.correlation) ? f.correlation : 0;
            corrSnapRef.current.push(corr);
            if (corrSnapRef.current.length > histMaxSamples) corrSnapRef.current.shift();
            vectorSnapRef.current.push(f.vectorscopePath || "");
            if (vectorSnapRef.current.length > histMaxSamples) vectorSnapRef.current.shift();

            if (!SPECTRUM_SETTINGS.freeze) {
              spectrumSnapRef.current.push(f.spectrumPath || "");
              if (spectrumSnapRef.current.length > histMaxSamples) spectrumSnapRef.current.shift();
              const centers = f.spectrumBandCentersHz || [];
              const dbList = f.spectrumSmoothDb || [];
              const nyquist = (pick.defaultSampleRate || 48000) * 0.5;
              const minF = Math.max(20, SPECTRUM_SETTINGS.minHz || 20);
              const maxF = Math.max(minF * 1.2, Math.min(SPECTRUM_SETTINGS.maxHz || 20000, nyquist));
              const bands = buildRtaBands(minF, maxF, SPECTRUM_SETTINGS.resolution || "1/6");
              const spectrumData =
                bands.length === dbList.length && dbList.length > 0
                  ? { bands, dbList: [...dbList] }
                  : {
                      bands: centers.map((fc) => ({ fLow: fc, fHigh: fc, fCenter: fc })),
                      dbList: [...dbList],
                    };
              spectrumDataRef.current = spectrumData;
              spectrumDataSnapRef.current.push(spectrumData);
              if (spectrumDataSnapRef.current.length > histMaxSamples) spectrumDataSnapRef.current.shift();
              if (selectedOffsetRef.current < 0 && shouldPaintUi) {
                setSpectrumPath(f.spectrumPath || "");
                setSpectrumPeakPath(f.spectrumPeakPath || "");
                setVectorPath(f.vectorscopePath || "");
              }
            }

            const nextHist = loudnessHistRef.current;
            if (nextHist.length > histMaxSamples) nextHist.shift();
            histRef.current = nextHist;
            if (selectedOffsetRef.current < 0 && shouldPaintUi) {
              setHistoryPathM("");
              setHistoryPathST("");
            }
          };

          await startAudioCapture({
            deviceId: pick.id,
            onFrame: applyFrame,
          });
          if (!mounted) return;
          audioRef.current = { mode: "tauri", unsubs };
          setStatus(statusMain);
          setStatus2(`Input: ${pick.label}`);
          spectrumTimeRef.current = performance.now() / 1000;
          return;
        }

        setRunning(false);
        setSelectedOffset(-1);
        setStatus("Browser preview: metering runs in the desktop app (Rust DSP). Use `npm run tauri dev`.");
        setStatus2("Input: Not connected");
      } catch (err) {
        setRunning(false);
        setSelectedOffset(-1);
        setStatus(`Error: ${err?.message || "Audio unavailable"}`);
        setStatus2("Input: Not connected");
      }
    };
    init();
    return () => {
      mounted = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (audioRef.current?.mode === "tauri") {
        void stopAudioCapture();
        for (const u of audioRef.current?.unsubs || []) {
          try {
            u();
          } catch (_) {}
        }
      }
      if (audioRef.current) {
        try {
          audioRef.current.stream?.getTracks()?.forEach((t) => t.stop());
        } catch (_) {}
        try {
          audioRef.current.ctx?.close();
        } catch (_) {}
      }
    };
  }, [running, captureDeviceId]);
}
