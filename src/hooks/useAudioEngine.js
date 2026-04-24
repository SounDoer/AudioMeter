import { useEffect, useRef } from "react";
import { listAudioDevices, startAudioCapture, stopAudioCapture } from "../ipc/commands.js";
import { onLoudnessSlow } from "../ipc/events.js";
import { isTauri } from "../ipc/env.js";
import { buildTauriFrameApply } from "./tauriFrameApply.js";

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
  const defaultSampleRateRef = useRef(48000);

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
          defaultSampleRateRef.current = pick.defaultSampleRate || 48000;
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

          const { applyFrame: baseApply } = buildTauriFrameApply({
            histMaxSamples,
            loudnessHistRef,
            spectrumDataRef,
            spectrumDataSnapRef,
            spectrumSnapRef,
            vectorSnapRef,
            corrSnapRef,
            audioSnapRef,
            frameRef,
            selectedOffsetRef,
            histRef: histRef,
            defaultSampleRateRef,
            setAudio,
            setSpectrumPath,
            setSpectrumPeakPath,
            setVectorPath,
            setHistoryPathM,
            setHistoryPathST,
          });
          const applyFrame = (f) => {
            if (!mounted) return;
            baseApply(f);
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
