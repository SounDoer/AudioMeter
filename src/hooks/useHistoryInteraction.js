import { useCallback, useRef } from "react";

export function useHistoryInteraction({
  sampleSec,
  minWindowSec,
  maxWindowSec,
  defaultWindowSec,
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
}) {
  const dragModeRef = useRef(null);
  const panStartRef = useRef({ x: 0, offset: 0 });
  const lastRightDownTsRef = useRef(0);

  const showHistoryHud = useCallback((ms = 1600) => {
    setHistoryHudUntilTs(Date.now() + Math.max(200, ms));
  }, [setHistoryHudUntilTs]);

  const holdHistoryHud = useCallback((on) => {
    setHistoryHudHold(Boolean(on));
    if (on) showHistoryHud(2200);
  }, [setHistoryHudHold, showHistoryHud]);

  const updateSelectionFromClientX = useCallback((clientX, rect) => {
    const width = Math.max(1, rect.width);
    const x = Math.max(0, Math.min(width, clientX - rect.left));
    const normalized = 1 - x / width;
    const fromEndSamples = effectiveOffsetSamples + normalized * Math.max(0, visibleSamples - 1);
    setSelectedOffset(Math.round(fromEndSamples) * sampleSec);
  }, [effectiveOffsetSamples, visibleSamples, setSelectedOffset, sampleSec]);

  const onHistoryPointerDown = useCallback((ev) => {
    const rect = ev.currentTarget.getBoundingClientRect();
    if (ev.button === 0) {
      dragModeRef.current = "select";
      holdHistoryHud(true);
      showHistoryHud(1600);
      updateSelectionFromClientX(ev.clientX, rect);
    } else if (ev.button === 2) {
      const nowTs = (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();
      if (nowTs - lastRightDownTsRef.current <= 320) {
        setHistoryWindowSec(defaultWindowSec);
        setHistoryOffsetSec(0);
        holdHistoryHud(false);
        showHistoryHud(1200);
        lastRightDownTsRef.current = 0;
        return;
      }
      lastRightDownTsRef.current = nowTs;
      if (totalSamples <= visibleSamples) return;
      dragModeRef.current = "pan";
      panStartRef.current = { x: ev.clientX, offset: effectiveOffsetSec };
      holdHistoryHud(true);
      showHistoryHud(1600);
    } else return;
    try {
      ev.currentTarget.setPointerCapture(ev.pointerId);
    } catch (_) {}
  }, [
    holdHistoryHud,
    showHistoryHud,
    updateSelectionFromClientX,
    setHistoryWindowSec,
    defaultWindowSec,
    setHistoryOffsetSec,
    totalSamples,
    visibleSamples,
    effectiveOffsetSec,
  ]);

  const onHistoryPointerMove = useCallback((ev) => {
    const mode = dragModeRef.current;
    if (!mode) return;
    const rect = ev.currentTarget.getBoundingClientRect();
    if (mode === "select") {
      showHistoryHud(1600);
      updateSelectionFromClientX(ev.clientX, rect);
      return;
    }
    const dx = ev.clientX - panStartRef.current.x;
    const secPerPx = (visibleSamples * sampleSec) / Math.max(1, rect.width);
    const next = Math.max(0, Math.min(maxOffsetSamples * sampleSec, panStartRef.current.offset + dx * secPerPx));
    setHistoryOffsetSec(next);
    showHistoryHud(1600);
  }, [showHistoryHud, updateSelectionFromClientX, visibleSamples, sampleSec, maxOffsetSamples, setHistoryOffsetSec]);

  const onHistoryPointerUp = useCallback((ev) => {
    dragModeRef.current = null;
    holdHistoryHud(false);
    showHistoryHud(900);
    try {
      ev.currentTarget.releasePointerCapture(ev.pointerId);
    } catch (_) {}
  }, [holdHistoryHud, showHistoryHud]);

  const onHistoryWheel = useCallback((ev) => {
    ev.preventDefault();
    showHistoryHud(1600);
    const factor = ev.deltaY < 0 ? 0.85 : 1.18;
    const rect = ev.currentTarget.getBoundingClientRect();
    const width = Math.max(1, rect.width);
    const x = Math.max(0, Math.min(width, ev.clientX - rect.left));
    const norm = 1 - x / width;
    const anchorFromEndSamples = effectiveOffsetSamples + norm * Math.max(0, visibleSamples - 1);
    const baselineSec = Math.max(sampleSec, visibleSamples * sampleSec);
    const next = Math.max(minWindowSec, Math.min(maxWindowSec, baselineSec * factor));
    const nextVisibleSamples = Math.max(1, Math.min(Math.max(1, totalSamples), Math.round(next / sampleSec)));
    const nextMaxOffsetSamples = Math.max(0, totalSamples - nextVisibleSamples);
    const nextOffsetSamples = Math.max(
      0,
      Math.min(
        nextMaxOffsetSamples,
        Math.round(anchorFromEndSamples - norm * Math.max(0, nextVisibleSamples - 1))
      )
    );
    setHistoryWindowSec(next);
    setHistoryOffsetSec(nextOffsetSamples * sampleSec);
  }, [
    showHistoryHud,
    effectiveOffsetSamples,
    visibleSamples,
    sampleSec,
    minWindowSec,
    maxWindowSec,
    totalSamples,
    setHistoryWindowSec,
    setHistoryOffsetSec,
  ]);

  return {
    showHistoryHud,
    holdHistoryHud,
    onHistoryPointerDown,
    onHistoryPointerMove,
    onHistoryPointerUp,
    onHistoryWheel,
  };
}
