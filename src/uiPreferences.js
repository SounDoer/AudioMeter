/**
 * 全局 UI 可调参数（单文件）——`applyUiPreferencesToDocument` 写入 `--ui-*`；布局与主题与 `layoutPersistKey` 一并持久化。
 *
 * 结构分区（Ctrl+F）：
 * - `layoutPersistKey` — localStorage 键（换键即放弃该键下旧数据）
 * - `layout` — 整体：shell、splitters、三栏拖拽、顶底栏、article、spacingRem、heightsRem、widthsPx、settingsModal
 * - `typography` / `radii` — 字号字重、圆角
 * - `themes` — 按主题 id：`colors` + 可选 `charts`、`spectrumGrid`、`meterGradient` 覆盖
 * - `modules.peak` — 表盘渐变（可被主题覆盖）
 * - `modules.loudness` — History 默认窗长、Metrics 行、响度曲线 charts
 * - `modules.vector` — Vectorscope charts
 * - `modules.spectrum` — 谱图底网 + Spectrum charts
 *
 * 运行时：`getResolvedCharts(prefs, uiMode)` = 三模块 charts 底稿 + `themes[mode].charts` 合并。
 *
 * 调试：DevTools → `<html>` → Computed 里 `--ui-` 变量。
 */
function setCssVar(name, value) {
  if (value === undefined || value === null) return;
  document.documentElement.style.setProperty(name, String(value));
}

function mergeCharts(base, override) {
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

/** 三模块图表底稿 → `mergeCharts` 用的扁平形状（不含主题覆盖） */
function chartsBaseFromPrefs(prefs) {
  const { loudness, vector, spectrum } = prefs.modules;
  return {
    loudnessHistory: { ...loudness.charts.loudnessHistory },
    vectorscope: { ...vector.charts.vectorscope },
    spectrum: { ...spectrum.charts.spectrum },
  };
}

/**
 * 当前主题下的完整 charts（模块默认 + `themes[mode].charts`）。
 * @param {typeof UI_PREFERENCES} prefs
 * @param {"dark"|"light"} mode
 */
export function getResolvedCharts(prefs = UI_PREFERENCES, mode = "dark") {
  const m = mode === "light" ? "light" : "dark";
  return mergeCharts(chartsBaseFromPrefs(prefs), prefs.themes[m]?.charts);
}

/** 深色主题：页面/面板/文字/Peak 线/图例/设置弹层等（写入 --ui-color-*） */
const DARK_THEME_COLORS = {
  pageBg: "#111827", // 整页最外背景
  textPrimary: "#f3f4f6", // 主标题、正文高对比字
  textSecondary: "#d1d5db", // 次要说明
  textMuted: "#b3bcc8", // 再弱一级（小节标题、刻度感）- 提高扫读可见性
  textSubtle: "#8792a2", // Metrics 标签等更淡字，但避免在暗底上过隐
  panelBg: "#1f2937", // 各模块圆角卡片背景（Peak、History…）
  panelBgSplitter: "rgba(31, 41, 55, 0.8)", // 可拖拽分割条背景
  insetBg: "#111827", // 图表深底（内嵌谱图/History 等区域）
  insetDark: "rgba(3, 7, 18, 0.9)", // Metrics 每行深色条背景
  borderDefault: "rgba(51, 65, 85, 0.8)", // Metrics 行边框等
  divider: "#4b5563", // 页脚竖线、矢量轴等
  brand: "#3b82f6", // 主按钮「选中」、链接强调
  brandLight: "#60a5fa", // Logo「Meter」高亮
  brandHover: "#60a5fa", // 主按钮悬停
  controlBg: "#374151", // 设置里下拉、Close、主题未选中等灰底
  peakSamplePeak: "rgba(251, 191, 36, 0.95)", // Peak 条上采样峰值横线
  peakTruePeak: "rgba(207, 250, 254, 0.7)", // True peak 横线
  tpMaxText: "#67e8f9", // 底部 TP MAX 数值强调色
  correlation: {
    bad: "#f87171", // 相关度偏低
    mid: "#fcd34d", // 相关度中间
    good: "#6ee7b7", // 相关度良好
  },
  loudnessTargetLine: "rgba(74, 222, 128, 0.85)", // History 目标 LUFS 虚线（绿）
  settingsOverlay: "rgba(0, 0, 0, 0.6)", // 设置弹窗背后遮罩
  settingsRowBg: "rgba(17, 24, 39, 0.7)", // 设置里每一行选项条背景
  legendHistOnBg: "#374151", // History 图例按钮「开」
  legendHistOnText: "#f3f4f6",
  legendHistOffBg: "#111827", // History 图例按钮「关」
  legendHistOffText: "#9ca3af",
  metricRowBg: "rgba(31, 41, 55, 0.28)", // Metrics 普通条目背景（弱化，融入面板）
  metricRowBorder: "rgba(71, 85, 105, 0.5)", // Metrics 普通条目边框
  metricRowHoverBg: "rgba(30, 41, 59, 0.42)", // Metrics 按钮 hover 背景
  metricRowToggleOnBg: "rgba(30, 58, 138, 0.22)", // Metrics 按钮选中背景
  metricRowToggleOnBorder: "#3b82f6", // Metrics 按钮选中边框
  metricRowToggleOnGlow: "rgba(59, 130, 246, 0.35)", // Metrics 按钮选中发光
  metricLabelText: "#94a3b8", // Metrics 名称
  metricValueText: "#f8fafc", // Metrics 数值
  metricUnitText: "#cbd5e1", // Metrics 单位
  metricToggleOnLabelText: "#dbeafe", // Metrics 选中名称
  metricToggleOnUnitText: "#bfdbfe", // Metrics 选中单位
  targetLabel: "#d1d5db", // 「Target」文字
  targetValue: "#4ade80", // History 纵轴目标 LUFS 刻度（绿）
  controlHoverBg: "#6b7280", // 浅交互控件 hover 底色
  settingsDialogShadow: "0 25px 50px -12px rgb(0 0 0 / 0.5)", // 设置弹窗阴影
};

/** 浅色主题：语义与 DARK_THEME_COLORS 一一对应，数值为浅底可读配色 */
const LIGHT_THEME_COLORS = {
  pageBg: "#e5e7eb",
  textPrimary: "#111827",
  textSecondary: "#374151",
  textMuted: "#334155",
  textSubtle: "#475569",
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
  loudnessTargetLine: "rgba(22, 163, 74, 0.8)", // History 目标虚线（绿）
  settingsOverlay: "rgba(15, 23, 42, 0.35)",
  settingsRowBg: "rgba(243, 244, 246, 0.95)",
  legendHistOnBg: "#e5e7eb",
  legendHistOnText: "#111827",
  legendHistOffBg: "#f3f4f6",
  legendHistOffText: "#4b5563",
  metricRowBg: "rgba(255, 255, 255, 0.55)",
  metricRowBorder: "rgba(148, 163, 184, 0.5)",
  metricRowHoverBg: "rgba(248, 250, 252, 0.92)",
  metricRowToggleOnBg: "rgba(219, 234, 254, 0.72)",
  metricRowToggleOnBorder: "#2563eb",
  metricRowToggleOnGlow: "rgba(37, 99, 235, 0.25)",
  metricLabelText: "#475569",
  metricValueText: "#0f172a",
  metricUnitText: "#475569",
  metricToggleOnLabelText: "#1e40af",
  metricToggleOnUnitText: "#1d4ed8",
  targetLabel: "#4b5563",
  targetValue: "#15803d", // History 纵轴目标刻度（绿）
  controlHoverBg: "#d3ddea", // 浅交互控件 hover 底色
  settingsDialogShadow: "0 16px 34px -14px rgb(15 23 42 / 0.28)", // 设置弹窗阴影（浅色更轻）
};

export const UI_PREFERENCES = {
  layoutPersistKey: "am.react.layout",

  layout: {
    shell: {
      maxWidthPx: 1600,
      paddingRem: { base: 0.8, lg: 1.2 },
      gapRem: { base: 0.55, lg: 0.6 },
    },
    splitters: {
      sectionGapPx: 8,
      barThicknessPx: 1,
      loudnessGapPx: 8,
    },
    header: {
      paddingXRem: 0.9,
      paddingYRem: 0.55,
    },
    footer: {
      paddingXRem: 1,
      paddingYRem: 0.65,
    },
    articlePadding: {
      defaultXRem: 0.7,
      defaultYRem: 0.5,
      metricsRem: 0,
      sectionTitleGapRem: 0.4,
      metricsTitleGapRem: 0.4,
    },
    spacingRem: {
      headerActionGap: 0.35,
      panelFooterGap: 0.4,
      inlineValueGap: 0.4,
      metricsListGap: 0.45,
      axisGapX: 0.4,
      axisGapY: 0.4,
      peakAxisChartGap: 0.5,
      peakChannelGap: 0.4,
      peakDisplayTopInset: 0.5,
      peakDisplayBottomInset: 0.5,
      meterChartInsetX: 0.6,
      meterLabelLeftInset: 1.6,
      meterLabelTopInset: 0.75,
      tpInfoLeftBlank: 5.4,
      chartOuterInset: 0,
      vectorCornerInset: 0.4,
      corrInfoLeftBlank: 4,
      historyDisplayTopInset: 0.1,
      historyDisplayBottomInset: 0,
      historySvgPad: 0.4,
      hudInset: 0.25,
      spectrumDisplayTopInset: 0.5,
      spectrumDisplayBottomInset: 0,
      spectrumSvgPad: 0.4,
    },
    settingsModal: {
      maxWidthRem: 28,
      paddingRem: 1.25,
      overlayPaddingRem: 1,
      headerGapRem: 1.25,
      contentGapRem: 1,
      inlineGapRem: 0.5,
      actionPadXRem: 0.75,
      actionPadYRem: 0.25,
    },
    mainColumn: {
      initialPx: 270,
      dragMinPx: 240,
      dragMaxPx: 360,
    },
    leftSplit: {
      initialRatio: 0.6,
      dragMinRatio: 0.5,
      dragMaxRatio: 0.72,
      dragPixelsPerDelta: 500,
    },
    rightSplit: {
      initialRatio: 0.5,
      dragMinRatio: 0.34,
      dragMaxRatio: 0.76,
      dragPixelsPerDelta: 650,
    },
    loudnessHistMetrics: {
      initialRatio: 0.7,
      dragMinRatio: 0.56,
      dragMaxRatio: 0.88,
      dragPixelsPerDelta: 720,
    },
    heightsRem: {
      peakModuleMin: 12,
      historyModuleMin: 10,
      spectrumModuleMin: 10,
      historyChartMin: 8,
      chartXAxisRowRem: 0.6,
    },
    widthsPx: {
      loudnessYAxis: 24,
      spectrumYAxis: 24,
      peakTickCol: 24,
    },
  },

  typography: {
    fontFamily: 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    sizesPx: {
      title: 18,
      section: 12,
      axisValue: 13,
      axisUnit: 11,
      extraValue: 13,
      metricMeta: 14,
      metricValue: 18,
      action: 14,
      status: 13,
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

  themes: {
    dark: {
      colors: DARK_THEME_COLORS,
    },
    light: {
      colors: LIGHT_THEME_COLORS,
      charts: {
        loudnessHistory: {
          momentaryStroke: "#0e7490",
          momentaryStrokeSnap: "#c2410c",
          shortTermStroke: "#1d4ed8",
          shortTermStrokeSnap: "#9a3412",
          selectionStroke: "#c2410c",
        },
        vectorscope: {
          strokeLive: "#1d4ed8",
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

  modules: {
    peak: {
      meterGradient: {
        top: "#f97373",
        mid: "#fbbf3b",
        midStopPercent: 46,
        bottom: "#34d399",
      },
    },
    loudness: {
      history: {
        defaultWindowSec: 120,
      },
      metrics: {
        valueColumnCh: 6.5,
        unitColumnRem: 3.1,
        rowMinHeightRem: 2.5,
        rowPaddingXRem: 0.5,
        rowPaddingYRem: 0.375,
        rowGapRem: 0.5,
      },
      charts: {
        loudnessHistory: {
          momentaryStroke: "#22d3ee",
          momentaryStrokeSnap: "#fb923c",
          momentaryStrokeWidth: 1.2,
          shortTermStroke: "#007AFF",
          shortTermStrokeSnap: "#f59e0b",
          shortTermStrokeWidth: 1.2,
          shortTermOpacity: 0.95,
          selectionStroke: "#f59e0b",
          selectionStrokeWidth: 1.2,
          /** History 与纵轴刻度对齐的水平参考线（可写任意 CSS <color>，含 color-mix） */
          historyGridLineColor: "color-mix(in srgb, var(--ui-color-divider) 10%, transparent)",
        },
      },
    },
    vector: {
      charts: {
        vectorscope: {
          strokeLive: "#007AFF",
          strokeSnap: "#f59e0b",
          strokeWidth: 1,
          axisOpacity: 0.8,
          gridDiagInsetPct: 1.2,
          plotRadius: 240,
          /** 底图对角虚线：CSS <color>；`gridDiagDash` 为 viewBox 0–100 下 stroke-dasharray 用户单位 */
          gridDiagStroke: "color-mix(in srgb, var(--ui-color-divider) 80%, transparent)",
          gridDiagDash: "2.6 3.4",
        },
      },
    },
    spectrum: {
      spectrumGrid: {
        verticalLineOpacity: 0.08,
        horizontalLineOpacity: 0.08,
        verticalSpacingPx: 56,
        horizontalSpacingPx: 34,
      },
      charts: {
        spectrum: {
          strokeLive: "#007AFF",
          strokeSnap: "#f59e0b",
          strokeWidth: 1.5,
          fillOpacityTop: 0.22,
          fillOpacityBottom: 0.03,
        },
      },
    },
  },
};

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
  const charts = getResolvedCharts(prefs, m);
  const spectrumGrid = mergeShallow(prefs.modules.spectrum.spectrumGrid, theme.spectrumGrid);
  const meterGradient = mergeShallow(prefs.modules.peak.meterGradient, theme.meterGradient);
  const { typography, radii } = prefs;
  const {
    shell,
    splitters,
    header,
    footer,
    articlePadding,
    spacingRem,
    settingsModal,
    heightsRem,
    widthsPx,
  } = prefs.layout;

  setCssVar("--ui-font-sans", typography.fontFamily);
  setCssVar("color-scheme", m);

  const s = typography.sizesPx;
  setCssVar("--ui-fs-app-title", `${s.title}px`);
  setCssVar("--ui-fs-section", `${s.section}px`);
  setCssVar("--ui-fs-settings-heading", `${s.section}px`);
  setCssVar("--ui-fs-axis-value", `${s.axisValue}px`);
  setCssVar("--ui-fs-axis-unit", `${s.axisUnit}px`);
  setCssVar("--ui-fs-extra", `${s.extraValue}px`);
  setCssVar("--ui-fs-metric-meta", `${s.metricMeta}px`);
  setCssVar("--ui-fs-metric-value", `${s.metricValue}px`);
  setCssVar("--ui-fs-action", `${s.action}px`);
  setCssVar("--ui-fs-status", `${s.status}px`);
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
  setCssVar("--ui-color-settings-overlay", colors.settingsOverlay);
  setCssVar("--ui-color-settings-row-bg", colors.settingsRowBg);
  setCssVar("--ui-color-legend-on-bg", colors.legendHistOnBg);
  setCssVar("--ui-color-legend-on-text", colors.legendHistOnText);
  setCssVar("--ui-color-legend-off-bg", colors.legendHistOffBg);
  setCssVar("--ui-color-legend-off-text", colors.legendHistOffText);
  setCssVar("--ui-color-metric-row-bg", colors.metricRowBg);
  setCssVar("--ui-color-metric-row-border", colors.metricRowBorder);
  setCssVar("--ui-color-metric-row-hover-bg", colors.metricRowHoverBg);
  setCssVar("--ui-color-metric-row-toggle-on-bg", colors.metricRowToggleOnBg);
  setCssVar("--ui-color-metric-row-toggle-on-border", colors.metricRowToggleOnBorder);
  setCssVar("--ui-color-metric-row-toggle-on-glow", colors.metricRowToggleOnGlow);
  setCssVar("--ui-color-metric-label", colors.metricLabelText);
  setCssVar("--ui-color-metric-value", colors.metricValueText);
  setCssVar("--ui-color-metric-unit", colors.metricUnitText);
  setCssVar("--ui-color-metric-toggle-on-label", colors.metricToggleOnLabelText);
  setCssVar("--ui-color-metric-toggle-on-unit", colors.metricToggleOnUnitText);
  setCssVar("--ui-color-target-label", colors.targetLabel);
  setCssVar("--ui-color-target-value", colors.targetValue);
  setCssVar("--ui-color-control-hover-bg", colors.controlHoverBg);
  setCssVar("--ui-shadow-settings-dialog", colors.settingsDialogShadow);

  setCssVar("--ui-chart-momentary", charts.loudnessHistory.momentaryStroke);
  setCssVar("--ui-chart-momentary-snap", charts.loudnessHistory.momentaryStrokeSnap);
  setCssVar("--ui-chart-shortterm", charts.loudnessHistory.shortTermStroke);
  setCssVar("--ui-chart-shortterm-snap", charts.loudnessHistory.shortTermStrokeSnap);
  setCssVar("--ui-chart-selection", charts.loudnessHistory.selectionStroke);
  setCssVar("--ui-chart-vectorscope-live", charts.vectorscope.strokeLive);
  setCssVar("--ui-chart-vectorscope-snap", charts.vectorscope.strokeSnap);
  setCssVar("--ui-chart-spectrum-live", charts.spectrum.strokeLive);
  setCssVar("--ui-chart-spectrum-snap", charts.spectrum.strokeSnap);
  setCssVar("--ui-chart-spectrum-fill-top", String(charts.spectrum.fillOpacityTop ?? 0.18));
  setCssVar("--ui-chart-spectrum-fill-bottom", String(charts.spectrum.fillOpacityBottom ?? 0.02));

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

  setCssVar("--ui-meter-grad-top", meterGradient.top);
  setCssVar("--ui-meter-grad-mid", meterGradient.mid);
  setCssVar("--ui-meter-grad-mid-stop", `${meterGradient.midStopPercent}%`);
  setCssVar("--ui-meter-grad-bottom", meterGradient.bottom);

  setCssVar("--ui-min-h-peak", `${heightsRem.peakModuleMin}rem`);
  setCssVar("--ui-min-h-history", `${heightsRem.historyModuleMin}rem`);
  setCssVar("--ui-min-h-spectrum", `${heightsRem.spectrumModuleMin}rem`);
  setCssVar("--ui-min-h-history-chart", `${heightsRem.historyChartMin}rem`);
  setCssVar("--ui-chart-x-axis-row-h", `${heightsRem.chartXAxisRowRem}rem`);

  setCssVar("--ui-w-loudness-y-axis", `${widthsPx.loudnessYAxis}px`);
  setCssVar("--ui-w-spectrum-y-axis", `${widthsPx.spectrumYAxis}px`);
  setCssVar("--ui-w-peak-ticks", `${widthsPx.peakTickCol}px`);

  setCssVar("--ui-section-gap", `${splitters.sectionGapPx}px`);
  // splitters track size drives actual section spacing
  setCssVar("--ui-splitter-main", `${splitters.sectionGapPx}px`);
  setCssVar("--ui-splitter-row", `${splitters.sectionGapPx}px`);
  setCssVar("--ui-loudness-gap", `${splitters.loudnessGapPx}px`);
  // visual splitter bar thickness inside the track
  setCssVar("--ui-splitter-bar-thickness", `${splitters.barThicknessPx}px`);

  const lm = prefs.modules.loudness.metrics;
  setCssVar("--ui-metric-row-min-h", `${lm.rowMinHeightRem}rem`);
  setCssVar("--ui-metric-row-pad-x", `${lm.rowPaddingXRem}rem`);
  setCssVar("--ui-metric-row-pad-y", `${lm.rowPaddingYRem}rem`);
  setCssVar("--ui-metric-row-gap", `${lm.rowGapRem}rem`);

  setCssVar("--ui-header-pad-x", `${header.paddingXRem}rem`);
  setCssVar("--ui-header-pad-y", `${header.paddingYRem}rem`);

  setCssVar("--ui-article-pad-x", `${articlePadding.defaultXRem}rem`);
  setCssVar("--ui-article-pad-y", `${articlePadding.defaultYRem}rem`);
  setCssVar("--ui-article-pad-metrics", `${articlePadding.metricsRem}rem`);
  setCssVar("--ui-section-title-gap", `${articlePadding.sectionTitleGapRem}rem`);
  setCssVar("--ui-metrics-title-gap", `${articlePadding.metricsTitleGapRem}rem`);

  setCssVar("--ui-panel-footer-gap", `${spacingRem.panelFooterGap}rem`);
  setCssVar("--ui-metrics-list-gap", `${spacingRem.metricsListGap}rem`);
  setCssVar("--ui-axis-gap-x", `${spacingRem.axisGapX}rem`);
  setCssVar("--ui-header-action-gap", `${spacingRem.headerActionGap}rem`);
  setCssVar("--ui-inline-value-gap", `${spacingRem.inlineValueGap}rem`);
  setCssVar("--ui-tp-info-left-blank", `${spacingRem.tpInfoLeftBlank}rem`);
  setCssVar("--ui-corr-info-left-blank", `${spacingRem.corrInfoLeftBlank}rem`);
  setCssVar("--ui-axis-gap-y", `${spacingRem.axisGapY}rem`);
  setCssVar("--ui-peak-axis-chart-gap", `${spacingRem.peakAxisChartGap}rem`);
  setCssVar("--ui-peak-channel-gap", `${spacingRem.peakChannelGap}rem`);
  setCssVar("--ui-peak-display-top-inset", `${spacingRem.peakDisplayTopInset}rem`);
  setCssVar("--ui-peak-display-bottom-inset", `${spacingRem.peakDisplayBottomInset}rem`);
  setCssVar("--ui-meter-chart-inset-x", `${spacingRem.meterChartInsetX}rem`);
  setCssVar("--ui-meter-label-left-inset", `${spacingRem.meterLabelLeftInset}rem`);
  setCssVar("--ui-meter-label-top-inset", `${spacingRem.meterLabelTopInset}rem`);
  setCssVar("--ui-chart-outer-inset", `${spacingRem.chartOuterInset}rem`);
  setCssVar("--ui-vector-corner-inset", `${spacingRem.vectorCornerInset}rem`);
  setCssVar("--ui-history-display-top-inset", `${spacingRem.historyDisplayTopInset}rem`);
  setCssVar("--ui-history-display-bottom-inset", `${spacingRem.historyDisplayBottomInset}rem`);
  setCssVar("--ui-history-svg-pad", `${spacingRem.historySvgPad}rem`);
  setCssVar("--ui-hud-inset", `${spacingRem.hudInset}rem`);
  setCssVar("--ui-spectrum-display-top-inset", `${spacingRem.spectrumDisplayTopInset}rem`);
  setCssVar("--ui-spectrum-display-bottom-inset", `${spacingRem.spectrumDisplayBottomInset}rem`);
  setCssVar("--ui-spectrum-svg-pad", `${spacingRem.spectrumSvgPad}rem`);

  setCssVar("--ui-footer-pad-x", `${footer.paddingXRem}rem`);
  setCssVar("--ui-footer-pad-y", `${footer.paddingYRem}rem`);

  setCssVar("--ui-settings-modal-max-w", `${settingsModal.maxWidthRem}rem`);
  setCssVar("--ui-settings-modal-pad", `${settingsModal.paddingRem}rem`);
  setCssVar("--ui-settings-overlay-pad", `${settingsModal.overlayPaddingRem}rem`);
  setCssVar("--ui-settings-header-gap", `${settingsModal.headerGapRem}rem`);
  setCssVar("--ui-settings-content-gap", `${settingsModal.contentGapRem}rem`);
  setCssVar("--ui-settings-inline-gap", `${settingsModal.inlineGapRem}rem`);
  setCssVar("--ui-settings-action-pad-x", `${settingsModal.actionPadXRem}rem`);
  setCssVar("--ui-settings-action-pad-y", `${settingsModal.actionPadYRem}rem`);

  const lh = charts.loudnessHistory;
  setCssVar("--ui-lh-stroke-m-w", String(lh.momentaryStrokeWidth));
  setCssVar("--ui-lh-stroke-st-w", String(lh.shortTermStrokeWidth));
  setCssVar("--ui-lh-stroke-st-op", String(lh.shortTermOpacity));
  setCssVar("--ui-lh-stroke-sel-w", String(lh.selectionStrokeWidth));
  setCssVar("--ui-loudness-history-grid-line", lh.historyGridLineColor);

  const vs = charts.vectorscope;
  setCssVar("--ui-vs-stroke-w", String(vs.strokeWidth));
  setCssVar("--ui-vs-axis-op", String(vs.axisOpacity));
  setCssVar("--ui-vs-grid-diag-stroke", vs.gridDiagStroke);
  setCssVar("--ui-vs-grid-diag-dash", vs.gridDiagDash);

  const spectrum = charts.spectrum;
  setCssVar("--ui-sp-stroke-w", String(spectrum.strokeWidth));
  setCssVar("--ui-sp-fill-top", String(spectrum.fillOpacityTop ?? 0.18));
  setCssVar("--ui-sp-fill-bottom", String(spectrum.fillOpacityBottom ?? 0.02));
}
