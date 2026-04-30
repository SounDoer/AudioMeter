/** Values outside this range are shown as "-" (guards bogus / overflow-style readouts in the UI). */
export const METRIC_NEGATIVE_INFINITY_FLOOR = -200;
export const METRIC_POSITIVE_INFINITY_CEIL = 200;

export function fmtMetric(v) {
  if (!Number.isFinite(v)) return "-";
  if (v <= METRIC_NEGATIVE_INFINITY_FLOOR) return "-";
  if (v >= METRIC_POSITIVE_INFINITY_CEIL) return "-";
  return v.toFixed(1);
}
export function fmtSec(sec) {
  const s = Math.max(0, Math.round(sec));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rs = s % 60;
  return `${m}m${rs ? `${rs}s` : ""}`;
}
