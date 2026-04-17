import { FREQ_LABELS, SPEC_Y_TICKS, freqToXFrac, spectrumDbToTopFrac } from "../../scales";
import { UI_PREFERENCES } from "../../uiPreferences";

function buildSpectrumAreaPath(path) {
  if (!path) return "";
  return `${path} L 1000 260 L 0 260 Z`;
}

export function SpectrumPanel({
  displaySpectrumPath,
  displaySpectrumPeakPath,
  selectedOffset,
  spectrumHover,
  onSpectrumHoverMove,
  onSpectrumHoverLeave,
}) {
  const displaySpectrumAreaPath = buildSpectrumAreaPath(displaySpectrumPath);

  return (
    <article className="ui-article ui-min-h-spectrum flex-1">
      <div className="ui-section-title ui-section-title-main shrink-0">Spectrum</div>
      <div className="grid min-h-0 flex-1 grid-cols-[var(--ui-w-spectrum-y-axis)_minmax(0,1fr)] grid-rows-[minmax(0,1fr)_var(--ui-chart-x-axis-row-h)_auto] gap-x-[var(--ui-axis-gap-y)] gap-y-[var(--ui-axis-gap-x)] items-stretch ui-min-h-spectrum">
        <div className="ui-w-spectrum-y-axis relative min-h-0 shrink-0 text-[length:var(--ui-fs-axis-value)] text-[color:var(--ui-color-text-muted)]">
          <div className="absolute inset-x-0 top-[var(--ui-spectrum-display-top-inset)] bottom-[var(--ui-spectrum-display-bottom-inset)]">
            {SPEC_Y_TICKS.map(({ v, lb }) => (
              <span key={v} className="absolute right-0 -translate-y-1/2 leading-none" style={{ top: `${spectrumDbToTopFrac(v) * 100}%` }}>
                {lb}
              </span>
            ))}
          </div>
        </div>
        <div className="relative min-h-0 min-w-0">
          <div
            className="spectrum-grid ui-inset-chart-spectrum relative min-h-0 h-full rounded-lg bg-[var(--ui-color-inset-bg)]"
            onPointerMove={(e) => onSpectrumHoverMove?.(e.clientX, e.currentTarget.getBoundingClientRect())}
            onPointerLeave={onSpectrumHoverLeave}
          >
            <div className="absolute inset-0 min-h-0 min-w-0 px-[var(--ui-spectrum-svg-pad)] pt-[var(--ui-spectrum-display-top-inset)] pb-[var(--ui-spectrum-display-bottom-inset)]">
              <svg
                viewBox="0 0 1000 260"
                preserveAspectRatio="none"
                className="block h-full w-full min-h-0 min-w-0"
              >
                <defs>
                  <linearGradient id="spectrumFillLive" x1="0" x2="0" y1="0" y2="1">
                    <stop
                      offset="0%"
                      stopColor="var(--ui-chart-spectrum-live)"
                      stopOpacity="var(--ui-sp-fill-top, 0.18)"
                    />
                    <stop
                      offset="100%"
                      stopColor="var(--ui-chart-spectrum-live)"
                      stopOpacity="var(--ui-sp-fill-bottom, 0.02)"
                    />
                  </linearGradient>
                  <linearGradient id="spectrumFillSnap" x1="0" x2="0" y1="0" y2="1">
                    <stop
                      offset="0%"
                      stopColor="var(--ui-chart-spectrum-snap)"
                      stopOpacity="var(--ui-sp-fill-top, 0.18)"
                    />
                    <stop
                      offset="100%"
                      stopColor="var(--ui-chart-spectrum-snap)"
                      stopOpacity="var(--ui-sp-fill-bottom, 0.02)"
                    />
                  </linearGradient>
                </defs>
                {displaySpectrumPath ? (
                  <>
                    <path
                      d={displaySpectrumAreaPath}
                      fill={selectedOffset >= 0 ? "url(#spectrumFillSnap)" : "url(#spectrumFillLive)"}
                    />
                    <path
                      d={displaySpectrumPath}
                      fill="none"
                      stroke={selectedOffset >= 0 ? "var(--ui-chart-spectrum-snap)" : "var(--ui-chart-spectrum-live)"}
                      strokeWidth={UI_PREFERENCES.modules.spectrum.charts.spectrum.strokeWidth}
                    />
                    {displaySpectrumPeakPath ? (
                      <path
                        d={displaySpectrumPeakPath}
                        fill="none"
                        stroke="var(--ui-chart-spectrum-snap)"
                        strokeWidth={Math.max(1, UI_PREFERENCES.modules.spectrum.charts.spectrum.strokeWidth - 1)}
                        strokeDasharray="8 6"
                        opacity="0.8"
                      />
                    ) : null}
                  </>
                ) : null}
              </svg>
            </div>
            {spectrumHover ? (
              <div className="pointer-events-none absolute inset-[var(--ui-spectrum-svg-pad)] top-[var(--ui-spectrum-display-top-inset)] bottom-[var(--ui-spectrum-display-bottom-inset)] z-10">
                <div
                  className="absolute bottom-0 top-0 border-l border-dashed border-[color:var(--ui-color-text-secondary)] opacity-55"
                  style={{ left: `${spectrumHover.leftPct}%` }}
                />
                <div
                  className="absolute left-0 right-0 border-t border-dashed border-[color:var(--ui-color-text-secondary)] opacity-40"
                  style={{ top: `${spectrumHover.topPct}%` }}
                />
                <div
                  className="absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[color:var(--ui-color-panel-bg)] bg-[color:var(--ui-chart-spectrum-live)] shadow-[0_0_0_3px_color-mix(in_srgb,var(--ui-chart-spectrum-live)_22%,transparent)]"
                  style={{
                    left: `${spectrumHover.leftPct}%`,
                    top: `${spectrumHover.topPct}%`,
                    backgroundColor: selectedOffset >= 0 ? "var(--ui-chart-spectrum-snap)" : "var(--ui-chart-spectrum-live)",
                  }}
                />
                <div className="absolute left-[var(--ui-hud-inset)] top-[var(--ui-hud-inset)] rounded border border-[color:var(--ui-color-divider)] bg-[color:var(--ui-color-panel-bg-splitter)] px-2 py-1 text-[length:var(--ui-fs-axis-value)] text-[color:var(--ui-color-text-secondary)] shadow-sm">
                  <div>{spectrumHover.freqLabel}</div>
                  <div>{spectrumHover.dbLabel}</div>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div />
        <div className="ui-caption relative h-[var(--ui-chart-x-axis-row-h)] w-full">
          <div className="absolute inset-x-[var(--ui-spectrum-svg-pad)] top-0 h-full">
            {FREQ_LABELS.map(([f, lb]) => (
              <span key={f} className="absolute top-0 -translate-x-1/2 whitespace-nowrap" style={{ left: `${freqToXFrac(f) * 100}%` }}>
                {lb}
              </span>
            ))}
          </div>
        </div>

        <div />
        <div />
      </div>
    </article>
  );
}
