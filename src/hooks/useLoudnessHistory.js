import { useEffect, useMemo, useState } from "react";
import { loudnessHistY, LOUDNESS_TICKS } from "../scales";
import {
  buildHistoryPath,
  buildHistoryTimeAxisLabels,
  getHistoryViewport,
} from "../math/historyMath";
import { fmtMetric } from "../math/formatMath";
import { getLoudnessReferenceProfileById } from "../loudnessReferenceProfiles.js";
import { UI_PREFERENCES } from "../uiPreferences";

export const HIST_SAMPLE_SEC = 0.1;

const CHART_HEIGHT_PX = 220;

/**
 * History viewport state, derived display data, and loudness metrics for LoudnessPanel.
 *
 * @param {{ histSourceList, hasHistoryData, running, displayAudio, referenceProfileId, selectedOffset }} params
 */
export function useLoudnessHistory({
  histSourceList,
  hasHistoryData,
  running,
  displayAudio,
  referenceProfileId,
  selectedOffset,
}) {
  const [historyWindowSec, setHistoryWindowSec] = useState(
    UI_PREFERENCES.modules.loudness.history.defaultWindowSec
  );
  const [historyOffsetSec, setHistoryOffsetSec] = useState(0);
  const [historyHudUntilTs, setHistoryHudUntilTs] = useState(0);
  const [historyHudHold, setHistoryHudHold] = useState(false);
  const [histCurves, setHistCurves] = useState({ m: false, st: true });

  const historyChartInteractive = running || hasHistoryData;

  // Auto-dismiss HUD after its timer expires
  useEffect(() => {
    if (historyHudHold) return;
    const remain = historyHudUntilTs - Date.now();
    if (remain <= 0) return;
    const t = setTimeout(() => setHistoryHudUntilTs(0), remain + 24);
    return () => clearTimeout(t);
  }, [historyHudUntilTs, historyHudHold]);

  // Clear HUD when chart becomes non-interactive
  useEffect(() => {
    if (historyChartInteractive) return;
    setHistoryHudHold(false);
    setHistoryHudUntilTs(0);
  }, [historyChartInteractive]);

  // --- Viewport & display paths ---

  const totalSamples = histSourceList.length;
  const {
    clampedWindowSec,
    visibleSamples,
    maxOffsetSamples,
    effectiveOffsetSamples,
    effectiveOffsetSec,
  } = getHistoryViewport(totalSamples, historyWindowSec, historyOffsetSec, HIST_SAMPLE_SEC);

  const displayHistoryPathM = buildHistoryPath(
    histSourceList,
    "m",
    visibleSamples,
    effectiveOffsetSamples,
    (v) => loudnessHistY(v, CHART_HEIGHT_PX)
  );
  const displayHistoryPathST = buildHistoryPath(
    histSourceList,
    "st",
    visibleSamples,
    effectiveOffsetSamples,
    (v) => loudnessHistY(v, CHART_HEIGHT_PX)
  );

  const selectedHistSteps =
    selectedOffset >= 0 ? Math.max(0, Math.round(selectedOffset / HIST_SAMPLE_SEC)) : -1;
  const showSelLine =
    selectedOffset >= 0 &&
    totalSamples > 0 &&
    selectedHistSteps >= 0 &&
    selectedHistSteps < totalSamples;
  const isHistoryHudVisible =
    historyChartInteractive && (historyHudHold || historyHudUntilTs > Date.now());
  const selLineX = Math.max(
    0,
    Math.min(
      600,
      600 - ((selectedHistSteps - effectiveOffsetSamples) / Math.max(1, visibleSamples - 1)) * 600
    )
  );

  const historyTimeTicks = useMemo(
    () => buildHistoryTimeAxisLabels(historyOffsetSec, clampedWindowSec),
    [historyOffsetSec, clampedWindowSec]
  );

  // --- Loudness metrics for LoudnessPanel ---

  const referenceProfile = useMemo(
    () => getLoudnessReferenceProfileById(referenceProfileId),
    [referenceProfileId]
  );
  const targetLufs = Number.isFinite(referenceProfile?.targetLufs)
    ? referenceProfile.targetLufs
    : -23;

  const historyYAxisTicks = useMemo(() => {
    const out = [...LOUDNESS_TICKS];
    if (!out.some((t) => t.v === targetLufs)) out.push({ v: targetLufs, lb: String(targetLufs) });
    out.sort((a, b) => b.v - a.v);
    return out;
  }, [targetLufs]);

  const psr =
    Number.isFinite(displayAudio.tpMax) && Number.isFinite(displayAudio.shortTerm)
      ? displayAudio.tpMax - displayAudio.shortTerm
      : -Infinity;
  const plr =
    Number.isFinite(displayAudio.tpMax) && Number.isFinite(displayAudio.integrated)
      ? displayAudio.tpMax - displayAudio.integrated
      : -Infinity;

  const primaryMetrics = useMemo(
    () => [
      { label: "Momentary", value: fmtMetric(displayAudio.momentary), unit: "LUFS" },
      { label: "Short-term", value: fmtMetric(displayAudio.shortTerm), unit: "LUFS" },
      { label: "Integrated", value: fmtMetric(displayAudio.integrated), unit: "LUFS" },
      { label: "Momentary Max", value: fmtMetric(displayAudio.mMax), unit: "LUFS" },
      { label: "Short-term Max", value: fmtMetric(displayAudio.stMax), unit: "LUFS" },
      { label: "Loudness Range (LRA)", value: fmtMetric(displayAudio.lra), unit: "LU" },
    ],
    [displayAudio]
  );

  const secondaryMetrics = useMemo(
    () => [
      { label: "Dynamics (PSR)", value: fmtMetric(psr), unit: "dB" },
      { label: "Avg. Dynamics (PLR)", value: fmtMetric(plr), unit: "dB" },
    ],
    [psr, plr]
  );

  const toggleCurve = (key) => setHistCurves((prev) => ({ ...prev, [key]: !prev[key] }));

  return {
    // State & setters (consumed by useHistoryInteraction and clearAll / reset flows)
    historyWindowSec,
    setHistoryWindowSec,
    historyOffsetSec,
    setHistoryOffsetSec,
    historyHudUntilTs,
    setHistoryHudUntilTs,
    historyHudHold,
    setHistoryHudHold,
    histCurves,
    toggleCurve,
    // Viewport
    historyChartInteractive,
    totalSamples,
    clampedWindowSec,
    visibleSamples,
    maxOffsetSamples,
    effectiveOffsetSamples,
    effectiveOffsetSec,
    // Display
    displayHistoryPathM,
    displayHistoryPathST,
    selectedHistSteps,
    showSelLine,
    selLineX,
    isHistoryHudVisible,
    historyTimeTicks,
    // Metrics
    referenceProfile,
    targetLufs,
    historyYAxisTicks,
    primaryMetrics,
    secondaryMetrics,
  };
}
