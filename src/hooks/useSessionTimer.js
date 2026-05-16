import { useCallback, useEffect, useRef } from "react";

function formatClock(ms) {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/**
 * Session timer driven by rAF, decoupled from React render cycle.
 *
 * Usage:
 *   const { clockRef, elapsedMsRef, canClearRef, startTimer, stopTimer, resetTimer } = useSessionTimer();
 *
 * Attach `clockRef` to a DOM text node to get ~10Hz clock updates without
 * triggering React re-renders. Read `elapsedMsRef.current` for the accumulated ms.
 * Read `canClearRef.current` to gate the Clear button.
 *
 * The parent component is responsible for re-rendering when transport state changes
 * (e.g. switching ready↔live); the timer only touches the clock text node.
 */
export function useSessionTimer() {
  const runStartedAtRef = useRef(null); // Date.now() when last started, null when stopped
  const accumulatedMsRef = useRef(0); // ms accumulated from previous start/stop cycles
  const rafIdRef = useRef(0);
  const lastTickMsRef = useRef(0);
  const clockRef = useRef(null); // attach to a DOM text node
  const elapsedMsRef = useRef(0); // current total elapsed ms (readable by caller)
  const canClearRef = useRef(false);

  const updateClockDom = useCallback(() => {
    if (clockRef.current) {
      clockRef.current.textContent = formatClock(elapsedMsRef.current);
    }
  }, []);

  const tick = useCallback(
    (now) => {
      rafIdRef.current = requestAnimationFrame(tick);
      if (now - lastTickMsRef.current < 100) return; // ~10 Hz throttle
      lastTickMsRef.current = now;

      const running = runStartedAtRef.current !== null;
      if (running) {
        elapsedMsRef.current = accumulatedMsRef.current + (Date.now() - runStartedAtRef.current);
        canClearRef.current = true;
        updateClockDom();
      }
    },
    [updateClockDom]
  );

  const startTimer = useCallback(() => {
    if (runStartedAtRef.current !== null) return; // already running
    runStartedAtRef.current = Date.now();
    lastTickMsRef.current = 0;
    rafIdRef.current = requestAnimationFrame(tick);
  }, [tick]);

  const stopTimer = useCallback(() => {
    if (runStartedAtRef.current === null) return;
    accumulatedMsRef.current += Date.now() - runStartedAtRef.current;
    runStartedAtRef.current = null;
    elapsedMsRef.current = accumulatedMsRef.current;
    canClearRef.current = accumulatedMsRef.current > 0;
    cancelAnimationFrame(rafIdRef.current);
    updateClockDom();
  }, [updateClockDom]);

  const resetTimer = useCallback(() => {
    cancelAnimationFrame(rafIdRef.current);
    runStartedAtRef.current = null;
    accumulatedMsRef.current = 0;
    elapsedMsRef.current = 0;
    canClearRef.current = false;
    if (clockRef.current) clockRef.current.textContent = "";
  }, []);

  useEffect(() => {
    return () => cancelAnimationFrame(rafIdRef.current);
  }, []);

  return { clockRef, elapsedMsRef, canClearRef, startTimer, stopTimer, resetTimer };
}
