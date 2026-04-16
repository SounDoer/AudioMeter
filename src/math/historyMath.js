export const HISTORY_MIN_WINDOW_SEC = 5;
export const HISTORY_MAX_WINDOW_SEC = 1800;

export function getHistoryViewport(totalSamples, historyWindowSec, historyOffsetSec, sampleSec) {
  const safeTotal = Math.max(0, totalSamples);
  const clampedWindowSec = Math.max(HISTORY_MIN_WINDOW_SEC, Math.min(HISTORY_MAX_WINDOW_SEC, historyWindowSec));
  const windowSamples = Math.max(1, Math.round(clampedWindowSec / sampleSec));
  const visibleSamples = Math.max(1, Math.min(Math.max(1, safeTotal), windowSamples));
  const maxOffsetSamples = Math.max(0, safeTotal - visibleSamples);
  const effectiveOffsetSamples = Math.max(0, Math.min(maxOffsetSamples, Math.round(historyOffsetSec / sampleSec)));
  return {
    clampedWindowSec,
    windowSamples,
    visibleSamples,
    maxOffsetSamples,
    effectiveOffsetSamples,
    effectiveOffsetSec: effectiveOffsetSamples * sampleSec,
  };
}

export function buildHistoryPath(histSourceList, key, visibleSamples, effectiveOffsetSamples, toY, viewWidth = 600) {
  if (!histSourceList.length) return "";
  const total = histSourceList.length;
  const winSamples = Math.max(2, visibleSamples);
  const offSamples = Math.max(0, Math.min(Math.max(0, total - 2), effectiveOffsetSamples));
  const end = Math.max(1, total - offSamples);
  const start = Math.max(0, end - winSamples);
  const view = histSourceList.slice(start, end);
  if (view.length < 2) return "";
  return view
    .map((p, i) => `${i === 0 ? "M" : "L"} ${(i / Math.max(1, view.length - 1)) * viewWidth} ${toY(p[key])}`)
    .join(" ");
}
