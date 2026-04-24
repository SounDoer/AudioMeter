import { UI_PREFERENCES } from "../../uiPreferences";

export function VectorscopePanel({
  vsGridDiagInset,
  vsGridDiagFar,
  displayVectorPath,
  selectedOffset,
  hasCorrelationValue,
  correlation,
  onPopOut,
}) {
  return (
    <article className="ui-article ui-min-h-spectrum flex-1">
      <div className="flex min-w-0 items-start justify-between gap-2">
        <div className="ui-section-title ui-section-title-main min-w-0 shrink-0">Vectorscope</div>
        {onPopOut ? (
          <button
            type="button"
            className="shrink-0 rounded border border-[color:var(--ui-color-border)] bg-[var(--ui-color-surface-raised)] px-1.5 py-0.5 text-[length:var(--ui-fs-metric-meta)] text-[color:var(--ui-color-muted)] hover:text-[color:var(--ui-color-text)]"
            onClick={onPopOut}
          >
            Pop out
          </button>
        ) : null}
      </div>
      <div className="relative min-h-0 flex-1 rounded-lg bg-[var(--ui-color-inset-bg)]">
        <div className="absolute inset-[var(--ui-chart-outer-inset)] z-0 min-h-0 min-w-0 overflow-hidden">
          <svg
            className="pointer-events-none absolute inset-0 z-0 block h-full w-full"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden
          >
            <line
              x1={vsGridDiagInset}
              y1={vsGridDiagInset}
              x2={vsGridDiagFar}
              y2={vsGridDiagFar}
              stroke="var(--ui-vs-grid-diag-stroke)"
              strokeWidth="0.35"
              strokeDasharray="var(--ui-vs-grid-diag-dash)"
              vectorEffect="non-scaling-stroke"
            />
            <line
              x1={vsGridDiagFar}
              y1={vsGridDiagInset}
              x2={vsGridDiagInset}
              y2={vsGridDiagFar}
              stroke="var(--ui-vs-grid-diag-stroke)"
              strokeWidth="0.35"
              strokeDasharray="var(--ui-vs-grid-diag-dash)"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
          <svg
            viewBox="0 0 260 260"
            preserveAspectRatio="none"
            className="absolute inset-0 z-[1] block h-full w-full"
          >
            <path
              d={displayVectorPath || "M 130 130 L 130 130"}
              fill="none"
              stroke={selectedOffset >= 0 ? "var(--ui-chart-vectorscope-snap)" : "var(--ui-chart-vectorscope-live)"}
              strokeWidth={UI_PREFERENCES.modules.vector.charts.vectorscope.strokeWidth * 3}
              opacity={UI_PREFERENCES.modules.vector.charts.vectorscope.axisOpacity * 0.22}
              strokeLinecap="round"
            />
            <path
              d={displayVectorPath || "M 130 130 L 130 130"}
              fill="none"
              stroke={selectedOffset >= 0 ? "var(--ui-chart-vectorscope-snap)" : "var(--ui-chart-vectorscope-live)"}
              strokeWidth={UI_PREFERENCES.modules.vector.charts.vectorscope.strokeWidth}
              opacity={UI_PREFERENCES.modules.vector.charts.vectorscope.axisOpacity}
            />
            <circle
              cx="130"
              cy="130"
              r="2"
              fill={selectedOffset >= 0 ? "var(--ui-chart-vectorscope-snap)" : "var(--ui-chart-vectorscope-live)"}
            />
          </svg>
        </div>
        <span className="ui-caption absolute left-[var(--ui-vector-corner-inset)] top-[var(--ui-vector-corner-inset)]">L</span>
        <span className="ui-caption absolute right-[var(--ui-vector-corner-inset)] top-[var(--ui-vector-corner-inset)]">R</span>
        <span className="ui-caption absolute left-[var(--ui-vector-corner-inset)] bottom-[var(--ui-vector-corner-inset)]">-1</span>
        <span className="ui-caption absolute right-[var(--ui-vector-corner-inset)] bottom-[var(--ui-vector-corner-inset)]">+1</span>
      </div>
      <div className="mt-[var(--ui-panel-footer-gap)] flex shrink-0 items-baseline justify-start text-[length:var(--ui-fs-extra)]">
        <div className="shrink-0" style={{ width: "var(--ui-corr-info-left-blank)" }} />
        <div className="flex items-baseline gap-[var(--ui-inline-value-gap)]">
          <span className="text-[color:var(--ui-color-text-muted)]">CORRELATION</span>
          <span className={hasCorrelationValue ? "font-semibold tabular-nums text-[color:var(--ui-color-tp-max)]" : "font-semibold text-[color:var(--ui-color-text-muted)]"}>
            {hasCorrelationValue ? correlation.toFixed(2) : "-"}
          </span>
        </div>
      </div>
    </article>
  );
}
