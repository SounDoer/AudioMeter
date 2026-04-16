import { LOUDNESS_DB_MAX, LOUDNESS_DB_MIN, loudnessFromTopFrac } from "../../scales";
import { UI_PREFERENCES } from "../../uiPreferences";

export function LoudnessPanel({
  loudnessHistWidthRatio,
  historyYAxisTicks,
  targetLufs,
  hasHistoryData,
  running,
  setSelectedOffset,
  setStatus,
  holdHistoryHud,
  showHistoryHud,
  onHistoryWheel,
  onHistoryPointerDown,
  onHistoryPointerMove,
  onHistoryPointerUp,
  histCurves,
  displayHistoryPathM,
  displayHistoryPathST,
  selectedOffset,
  showSelLine,
  selLineX,
  isHistoryHudVisible,
  clampedWindowSec,
  effectiveOffsetSec,
  fmtSec,
  historyTimeTicks,
  historyTickSteps,
  primaryMetrics,
  secondaryMetrics,
  MetricRow,
  toggleCurve,
}) {
  return (
    <article className="ui-article ui-min-h-history">
      <div className="ui-section-title ui-section-title-main shrink-0">Loudness</div>
      <div
        className="grid h-full min-h-0 grid-cols-[var(--hmSplit)_minmax(0,1fr)] gap-x-[var(--ui-loudness-gap)]"
        style={{ "--hmSplit": `${Math.round(loudnessHistWidthRatio * 100)}%` }}
      >
        <div className="min-h-0 min-w-0">
          <div className="grid min-h-0 h-full grid-cols-[var(--ui-w-loudness-y-axis)_minmax(0,1fr)] grid-rows-[minmax(0,1fr)_var(--ui-chart-x-axis-row-h)_auto] gap-x-[var(--ui-axis-gap-y)] gap-y-[var(--ui-axis-gap-x)] items-stretch ui-min-h-history">
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
                  if (i === historyTickSteps) {
                    return <span key={`${i}-${tick}`} className="absolute right-0 top-0 text-right">{tick}</span>;
                  }
                  return (
                    <span
                      key={`${i}-${tick}`}
                      className="absolute top-0 -translate-x-1/2 text-center"
                      style={{ left: `${(i / historyTickSteps) * 100}%` }}
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
        </div>

        <div className="min-h-0 min-w-0 flex flex-col">
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
        </div>
      </div>
    </article>
  );
}
