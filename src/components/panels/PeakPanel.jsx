import { PEAK_TICKS, peakFromTopFrac } from "../../scales";

export function PeakPanel({
  displayAudio,
  renderPeakFill,
  getSamplePeakLineColor,
  fmt,
  hasTpMaxValue,
  tpMaxText,
}) {
  return (
    <article className="ui-article ui-min-h-peak min-h-0">
      <div className="shrink-0">
        <div className="ui-section-title ui-section-title-main shrink-0">Peak</div>
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-[auto_1fr] gap-[var(--ui-peak-axis-chart-gap)] ui-min-h-peak">
        <div className="ui-w-peak-ticks relative min-h-0 h-full shrink-0 overflow-visible text-right text-[length:var(--ui-fs-axis-value)] text-[color:var(--ui-color-text-muted)]">
          <div className="absolute inset-x-0 top-[var(--ui-peak-display-top-inset)] bottom-[var(--ui-peak-display-bottom-inset)]">
            {PEAK_TICKS.map(({ v, lb }) => (
              <span key={v} className="absolute right-0 -translate-y-1/2 leading-none" style={{ top: `${peakFromTopFrac(v) * 100}%` }}>
                {lb}
              </span>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-[var(--ui-peak-channel-gap)]">
          <div className="relative h-full min-h-0 rounded-lg bg-[var(--ui-color-inset-bg)] p-0">
            <div className="absolute inset-x-[var(--ui-meter-chart-inset-x)] bottom-[var(--ui-peak-display-bottom-inset)] top-[var(--ui-peak-display-top-inset)]">
              {renderPeakFill(displayAudio.sampleL)}
              {Number.isFinite(displayAudio.samplePeakMaxL) && (
                <div
                  className="pointer-events-none absolute inset-x-0 z-[5] border-t"
                  style={{
                    top: `${peakFromTopFrac(displayAudio.samplePeakMaxL) * 100}%`,
                    borderTopColor: getSamplePeakLineColor(displayAudio.samplePeakMaxL),
                  }}
                />
              )}
            </div>
            <div className="absolute left-[var(--ui-meter-label-left-inset)] right-0 top-[var(--ui-meter-label-top-inset)] text-left text-[length:var(--ui-fs-extra)] text-[color:var(--ui-color-text-secondary)]">
              L <span className="tabular-nums text-[color:var(--ui-color-text-muted)]">{fmt(displayAudio.sampleL)}</span>
            </div>
          </div>
          <div className="relative h-full min-h-0 rounded-lg bg-[var(--ui-color-inset-bg)] p-0">
            <div className="absolute inset-x-[var(--ui-meter-chart-inset-x)] bottom-[var(--ui-peak-display-bottom-inset)] top-[var(--ui-peak-display-top-inset)]">
              {renderPeakFill(displayAudio.sampleR)}
              {Number.isFinite(displayAudio.samplePeakMaxR) && (
                <div
                  className="pointer-events-none absolute inset-x-0 z-[5] border-t"
                  style={{
                    top: `${peakFromTopFrac(displayAudio.samplePeakMaxR) * 100}%`,
                    borderTopColor: getSamplePeakLineColor(displayAudio.samplePeakMaxR),
                  }}
                />
              )}
            </div>
            <div className="absolute left-[var(--ui-meter-label-left-inset)] right-0 top-[var(--ui-meter-label-top-inset)] text-left text-[length:var(--ui-fs-extra)] text-[color:var(--ui-color-text-secondary)]">
              R <span className="tabular-nums text-[color:var(--ui-color-text-muted)]">{fmt(displayAudio.sampleR)}</span>
            </div>
          </div>
        </div>
      </div>
      <div className="mt-[var(--ui-panel-footer-gap)] flex shrink-0 items-baseline justify-start text-[length:var(--ui-fs-extra)]">
        <div className="shrink-0" style={{ width: "var(--ui-tp-info-left-blank)" }} />
        <div className="flex items-baseline gap-[var(--ui-inline-value-gap)]">
          <span className="text-[color:var(--ui-color-text-muted)]">TP MAX</span>
          <span className={hasTpMaxValue ? "font-semibold text-[color:var(--ui-color-tp-max)]" : "font-semibold text-[color:var(--ui-color-text-muted)]"}>
            {tpMaxText}
          </span>
        </div>
      </div>
    </article>
  );
}
