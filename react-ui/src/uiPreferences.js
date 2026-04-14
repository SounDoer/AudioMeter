/**
 * 全局 UI 可调参数「单一入口」——改这一份即可试布局 / 字体 / 颜色 / 图表样式。
 *
 * 主题：`themes.dark` / `themes.light` 下的 `colors`（及可选 `charts`、`spectrumGrid`、
 * `meterGradient` 覆盖）会在 `applyUiPreferencesToDocument(prefs, uiMode)` 时合并进 CSS 变量。
 *
 * 注入：`main.jsx` 首屏按 localStorage 的 `uiMode` 调用一次；`App.jsx` 在 `uiMode` 变化时再调用。
 *
 * 其余说明见各区块注释；`layoutPersistKey` 勿随意改名。
 */
function setCssVar(name, value) {
  if (value === undefined || value === null) return;
  document.documentElement.style.setProperty(name, String(value));
}

export function mergeCharts(base, override) {
  if (!override) return base;
  return {
    loudnessHistory: { ...base.loudnessHistory, ...override.loudnessHistory },
    vectorscope: { ...base.vectorscope, ...override.vectorscope },
    spectrum: { ...base.spectrum, ...override.spectrum },
  };
}

function mergeShallow(base, override) {
  return { ...base, ...(override || {}) };
}

/** 与 App 持久化逻辑一致，用于首屏避免主题闪烁 */
export function readPersistedUiMode(prefs) {
  const p = prefs ?? UI_PREFERENCES;
  try {
    const raw = localStorage.getItem(p.layoutPersistKey);
    if (!raw) return "dark";
    const s = JSON.parse(raw);
    if (s.uiMode === "light" || s.uiMode === "dark") return s.uiMode;
  } catch (_) {}
  return "dark";
}

/**
 * @param {typeof UI_PREFERENCES} prefs
 * @param {"dark" | "light"} mode
 */
export function applyUiPreferencesToDocument(prefs = UI_PREFERENCES, mode = "dark") {
  const m = mode === "light" ? "light" : "dark";
  const theme = prefs.themes[m];
  const colors = theme.colors;
  const charts = mergeCharts(prefs.charts, theme.charts);
  const spectrumGrid = mergeShallow(prefs.spectrumGrid, theme.spectrumGrid);
  const meterGradient = mergeShallow(prefs.meterGradient, theme.meterGradient);
  const { typography, radii, shell, heightsRem, widthsPx } = prefs;

  setCssVar("--ui-font-sans", typography.fontFamily);
  setCssVar("color-scheme", m);

  const s = typography.sizesPx;
  setCssVar("--ui-fs-app-title", `${s.appTitle}px`);
  setCssVar("--ui-fs-section", `${s.sectionTitle}px`);
  setCssVar("--ui-fs-footer", `${s.footer}px`);
  setCssVar("--ui-fs-body", `${s.body}px`);
  setCssVar("--ui-fs-small", `${s.small}px`);
  setCssVar("--ui-fs-caption", `${s.caption}px`);
  setCssVar("--ui-fs-micro", `${s.micro}px`);
  setCssVar("--ui-fs-metric-value", `${s.metricValue}px`);
  setCssVar("--ui-fs-metric-label", `${s.metricLabel}px`);
  setCssVar("--ui-fs-settings-heading", `${s.settingsHeading}px`);
  setCssVar("--ui-fw-app-title", String(typography.weights.appTitle));
  setCssVar("--ui-fw-section", String(typography.weights.section));

  setCssVar("--ui-color-page-bg", colors.pageBg);
  setCssVar("--ui-color-text-primary", colors.textPrimary);
  setCssVar("--ui-color-text-secondary", colors.textSecondary);
  setCssVar("--ui-color-text-muted", colors.textMuted);
  setCssVar("--ui-color-text-subtle", colors.textSubtle);
  setCssVar("--ui-color-panel-bg", colors.panelBg);
  setCssVar("--ui-color-panel-bg-splitter", colors.panelBgSplitter);
  setCssVar("--ui-color-inset-bg", colors.insetBg);
  setCssVar("--ui-color-inset-dark", colors.insetDark);
  setCssVar("--ui-color-border-default", colors.borderDefault);
  setCssVar("--ui-color-divider", colors.divider);
  setCssVar("--ui-color-brand", colors.brand);
  setCssVar("--ui-color-brand-light", colors.brandLight);
  setCssVar("--ui-color-brand-hover", colors.brandHover);
  setCssVar("--ui-color-control-bg", colors.controlBg);
  setCssVar("--ui-color-peak-sample", colors.peakSamplePeak);
  setCssVar("--ui-color-peak-true", colors.peakTruePeak);
  setCssVar("--ui-color-tp-max", colors.tpMaxText);
  setCssVar("--ui-color-corr-bad", colors.correlation.bad);
  setCssVar("--ui-color-corr-mid", colors.correlation.mid);
  setCssVar("--ui-color-corr-good", colors.correlation.good);
  setCssVar("--ui-color-loudness-target-line", colors.loudnessTargetLine);
  setCssVar("--ui-color-snapshot-ring", colors.snapshotRing);
  setCssVar("--ui-color-snapshot-badge-bg", colors.snapshotBadgeBg);
  setCssVar("--ui-color-snapshot-badge-text", colors.snapshotBadgeText);
  setCssVar("--ui-color-settings-overlay", colors.settingsOverlay);
  setCssVar("--ui-color-settings-row-bg", colors.settingsRowBg);
  setCssVar("--ui-color-legend-on-bg", colors.legendHistOnBg);
  setCssVar("--ui-color-legend-on-text", colors.legendHistOnText);
  setCssVar("--ui-color-legend-off-bg", colors.legendHistOffBg);
  setCssVar("--ui-color-legend-off-text", colors.legendHistOffText);
  setCssVar("--ui-color-target-label", colors.targetLabel);
  setCssVar("--ui-color-target-value", colors.targetValue);

  setCssVar("--ui-chart-momentary", charts.loudnessHistory.momentaryStroke);
  setCssVar("--ui-chart-shortterm", charts.loudnessHistory.shortTermStroke);
  setCssVar("--ui-chart-selection", charts.loudnessHistory.selectionStroke);
  setCssVar("--ui-chart-vectorscope-live", charts.vectorscope.strokeLive);
  setCssVar("--ui-chart-vectorscope-snap", charts.vectorscope.strokeSnap);
  setCssVar("--ui-chart-spectrum-live", charts.spectrum.strokeLive);
  setCssVar("--ui-chart-spectrum-snap", charts.spectrum.strokeSnap);

  setCssVar("--ui-radius-card", radii.card);
  setCssVar("--ui-radius-modal", radii.modal);
  setCssVar("--ui-radius-pill", radii.pill);
  setCssVar("--ui-radius-metric-row", radii.metricRow);

  setCssVar("--ui-shell-max-w", `${shell.maxWidthPx}px`);
  setCssVar("--ui-shell-pad", `${shell.paddingRem.base}rem`);
  setCssVar("--ui-shell-pad-lg", `${shell.paddingRem.lg}rem`);
  setCssVar("--ui-shell-gap", `${shell.gapRem.base}rem`);
  setCssVar("--ui-shell-gap-lg", `${shell.gapRem.lg}rem`);

  setCssVar("--ui-spectrum-grid-v", String(spectrumGrid.verticalLineOpacity));
  setCssVar("--ui-spectrum-grid-h", String(spectrumGrid.horizontalLineOpacity));
  setCssVar("--ui-spectrum-grid-v-size", `${spectrumGrid.verticalSpacingPx}px`);
  setCssVar("--ui-spectrum-grid-h-size", `${spectrumGrid.horizontalSpacingPx}px`);

  setCssVar("--ui-meter-grad-top", meterGradient.top);
  setCssVar("--ui-meter-grad-mid", meterGradient.mid);
  setCssVar("--ui-meter-grad-mid-stop", `${meterGradient.midStopPercent}%`);
  setCssVar("--ui-meter-grad-bottom", meterGradient.bottom);

  setCssVar("--ui-min-h-peak", `${heightsRem.peakModuleMin}rem`);
  setCssVar("--ui-min-h-history", `${heightsRem.historyModuleMin}rem`);
  setCssVar("--ui-min-h-spectrum", `${heightsRem.spectrumModuleMin}rem`);
  setCssVar("--ui-min-h-history-chart", `${heightsRem.historyChartMin}rem`);
  setCssVar("--ui-spectrum-freq-row-h", `${heightsRem.spectrumFreqRowRem}rem`);

  setCssVar("--ui-w-loudness-y-axis", `${widthsPx.loudnessYAxis}px`);
  setCssVar("--ui-w-spectrum-y-axis", `${widthsPx.spectrumYAxis}px`);
  setCssVar("--ui-w-peak-ticks", `${widthsPx.peakTickCol}px`);

  setCssVar("--ui-splitter-main", `${prefs.splitters.mainGutterPx}px`);
  setCssVar("--ui-splitter-row", `${prefs.splitters.rowGutterPx}px`);
  setCssVar("--ui-splitter-hm", `${prefs.splitters.histMetricsGutterPx}px`);

  const lm = prefs.loudnessMetrics;
  setCssVar("--ui-metric-row-min-h", `${lm.rowMinHeightRem}rem`);
  setCssVar("--ui-metric-row-pad-x", `${lm.rowPaddingXRem}rem`);
  setCssVar("--ui-metric-row-pad-y", `${lm.rowPaddingYRem}rem`);
  setCssVar("--ui-metric-row-gap", `${lm.rowGapRem}rem`);

  const h = prefs.header;
  setCssVar("--ui-header-pad-x", `${h.paddingXRem}rem`);
  setCssVar("--ui-header-pad-y", `${h.paddingYRem}rem`);

  const a = prefs.articlePadding;
  setCssVar("--ui-article-pad", `${a.defaultRem}rem`);
  setCssVar("--ui-article-pad-metrics", `${a.metricsRem}rem`);

  const f = prefs.footer;
  setCssVar("--ui-footer-pad-x", `${f.paddingXRem}rem`);
  setCssVar("--ui-footer-pad-y", `${f.paddingYRem}rem`);

  const sm = prefs.settingsModal;
  setCssVar("--ui-settings-modal-max-w", `${sm.maxWidthRem}rem`);
  setCssVar("--ui-settings-modal-pad", `${sm.paddingRem}rem`);
  setCssVar("--ui-settings-overlay-pad", `${sm.overlayPaddingRem}rem`);

  const lh = charts.loudnessHistory;
  setCssVar("--ui-lh-stroke-m-w", String(lh.momentaryStrokeWidth));
  setCssVar("--ui-lh-stroke-st-w", String(lh.shortTermStrokeWidth));
  setCssVar("--ui-lh-stroke-st-op", String(lh.shortTermOpacity));
  setCssVar("--ui-lh-stroke-sel-w", String(lh.selectionStrokeWidth));

  const vs = charts.vectorscope;
  setCssVar("--ui-vs-stroke-w", String(vs.strokeWidth));
  setCssVar("--ui-vs-axis-op", String(vs.axisOpacity));

  const sp = charts.spectrum;
  setCssVar("--ui-sp-stroke-w", String(sp.strokeWidth));
}

const DARK_THEME_COLORS = {
  pageBg: "#111827",
  textPrimary: "#f3f4f6",
  textSecondary: "#d1d5db",
  textMuted: "#9ca3af",
  textSubtle: "#6b7280",
  panelBg: "#1f2937",
  panelBgSplitter: "rgba(31, 41, 55, 0.8)",
  insetBg: "#111827",
  insetDark: "rgba(3, 7, 18, 0.9)",
  borderDefault: "rgba(51, 65, 85, 0.8)",
  divider: "#4b5563",
  brand: "#3b82f6",
  brandLight: "#60a5fa",
  brandHover: "#60a5fa",
  controlBg: "#374151",
  peakSamplePeak: "rgba(251, 191, 36, 0.95)",
  peakTruePeak: "rgba(207, 250, 254, 0.7)",
  tpMaxText: "#67e8f9",
  correlation: {
    bad: "#f87171",
    mid: "#fcd34d",
    good: "#6ee7b7",
  },
  loudnessTargetLine: "rgba(251, 191, 36, 0.7)",
  snapshotRing: "rgba(251, 191, 36, 0.5)",
  snapshotBadgeBg: "rgba(251, 191, 36, 0.15)",
  snapshotBadgeText: "#fde68a",
  settingsOverlay: "rgba(0, 0, 0, 0.6)",
  settingsRowBg: "rgba(17, 24, 39, 0.7)",
  legendHistOnBg: "#374151",
  legendHistOnText: "#f3f4f6",
  legendHistOffBg: "#111827",
  legendHistOffText: "#9ca3af",
  targetLabel: "#d1d5db",
  targetValue: "#fcd34d",
};

const LIGHT_THEME_COLORS = {
  pageBg: "#e5e7eb",
  textPrimary: "#111827",
  textSecondary: "#374151",
  textMuted: "#6b7280",
  textSubtle: "#9ca3af",
  panelBg: "#ffffff",
  panelBgSplitter: "rgba(209, 213, 219, 0.95)",
  insetBg: "#f9fafb",
  insetDark: "rgba(241, 245, 249, 0.98)",
  borderDefault: "rgba(148, 163, 184, 0.75)",
  divider: "#d1d5db",
  brand: "#2563eb",
  brandLight: "#3b82f6",
  brandHover: "#1d4ed8",
  controlBg: "#e5e7eb",
  peakSamplePeak: "rgba(217, 119, 6, 0.95)",
  peakTruePeak: "rgba(8, 145, 178, 0.85)",
  tpMaxText: "#0e7490",
  correlation: {
    bad: "#dc2626",
    mid: "#ca8a04",
    good: "#15803d",
  },
  loudnessTargetLine: "rgba(217, 119, 6, 0.75)",
  snapshotRing: "rgba(217, 119, 6, 0.45)",
  snapshotBadgeBg: "rgba(251, 191, 36, 0.25)",
  snapshotBadgeText: "#92400e",
  settingsOverlay: "rgba(15, 23, 42, 0.35)",
  settingsRowBg: "rgba(243, 244, 246, 0.95)",
  legendHistOnBg: "#e5e7eb",
  legendHistOnText: "#111827",
  legendHistOffBg: "#f3f4f6",
  legendHistOffText: "#6b7280",
  targetLabel: "#4b5563",
  targetValue: "#b45309",
};

export const UI_PREFERENCES = {
  layoutPersistKey: "am.react.layout.v1",

  themes: {
    dark: {
      colors: DARK_THEME_COLORS,
    },
    light: {
      colors: LIGHT_THEME_COLORS,
      charts: {
        loudnessHistory: {
          momentaryStroke: "#0e7490",
          shortTermStroke: "#1d4ed8",
          selectionStroke: "#c2410c",
        },
        vectorscope: {
          strokeLive: "#0e7490",
          strokeSnap: "#c2410c",
        },
        spectrum: {
          strokeLive: "#1d4ed8",
          strokeSnap: "#c2410c",
        },
      },
      spectrumGrid: {
        verticalLineOpacity: 0.07,
        horizontalLineOpacity: 0.05,
      },
    },
  },

  splitters: {
    mainGutterPx: 8,
    rowGutterPx: 6,
    histMetricsGutterPx: 6,
  },

  shell: {
    maxWidthPx: 1600,
    paddingRem: { base: 1, lg: 1.5 },
    gapRem: { base: 0.75, lg: 1 },
  },

  typography: {
    fontFamily: 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    sizesPx: {
      appTitle: 20,
      sectionTitle: 14,
      footer: 12,
      body: 14,
      small: 12,
      caption: 10,
      micro: 9,
      metricValue: 18,
      metricLabel: 11,
      historyAxis: 10,
      settingsHeading: 16,
    },
    weights: {
      appTitle: 800,
      section: 600,
    },
  },

  radii: {
    card: "0.75rem",
    modal: "1rem",
    pill: "9999px",
    metricRow: "0.375rem",
  },

  charts: {
    loudnessHistory: {
      momentaryStroke: "#22d3ee",
      momentaryStrokeWidth: 2.2,
      shortTermStroke: "#007AFF",
      shortTermStrokeWidth: 2.6,
      shortTermOpacity: 0.95,
      selectionStrokeWidth: 1.2,
    },
    vectorscope: {
      strokeLive: "#22d3ee",
      strokeSnap: "#f59e0b",
      strokeWidth: 1.2,
      axisOpacity: 0.8,
    },
    spectrum: {
      strokeLive: "#007AFF",
      strokeSnap: "#f59e0b",
      strokeWidth: 3,
    },
  },

  spectrumGrid: {
    verticalLineOpacity: 0.04,
    horizontalLineOpacity: 0.03,
    verticalSpacingPx: 56,
    horizontalSpacingPx: 34,
  },

  meterGradient: {
    top: "#ef4444",
    mid: "#f59e0b",
    midStopPercent: 40,
    bottom: "#22c55e",
  },

  heightsRem: {
    peakModuleMin: 12,
    historyModuleMin: 10,
    spectrumModuleMin: 10,
    historyChartMin: 8,
    spectrumFreqRowRem: 1.25,
  },

  widthsPx: {
    loudnessYAxis: 34,
    spectrumYAxis: 36,
    peakTickCol: 36,
  },

  mainColumn: {
    initialPx: 360,
    dragMinPx: 280,
    dragMaxPx: 520,
  },

  leftSplit: {
    initialRatio: 0.56,
    dragMinRatio: 0.32,
    dragMaxRatio: 0.72,
    dragPixelsPerDelta: 500,
  },

  rightSplit: {
    initialRatio: 0.48,
    dragMinRatio: 0.34,
    dragMaxRatio: 0.76,
    dragPixelsPerDelta: 650,
  },

  loudnessHistMetrics: {
    initialRatio: 0.64,
    dragMinRatio: 0.5,
    dragMaxRatio: 0.88,
    dragPixelsPerDelta: 720,
  },

  history: {
    defaultWindowSec: 120,
  },

  loudnessMetrics: {
    valueColumnCh: 7,
    unitColumnRem: 3.5,
    rowMinHeightRem: 2.125,
    rowPaddingXRem: 0.625,
    rowPaddingYRem: 0.375,
    rowGapRem: 0.5,
  },

  settingsModal: {
    maxWidthRem: 28,
    paddingRem: 1.25,
    overlayPaddingRem: 1,
  },

  header: {
    paddingXRem: 1.25,
    paddingYRem: 1,
  },

  articlePadding: {
    defaultRem: 1,
    metricsRem: 0.75,
  },

  footer: {
    paddingXRem: 1,
    paddingYRem: 0.5,
  },
};
