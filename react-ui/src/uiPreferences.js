/**
 * 全局 UI 可调参数（单文件，不拆包）——保存后热更新；改布局持久化用 Settings → Reset Layout。
 *
 * 只改配色/布局数字：可直接跳到 `DARK_THEME_COLORS` / `LIGHT_THEME_COLORS` / `export const UI_PREFERENCES`。
 * 改「如何把 prefs 写进页面」再看文末 `applyUiPreferencesToDocument`。
 *
 * ---------- 小白怎么找要改的东西（在本文档内 Ctrl+F 搜关键字）----------
 *
 * 1) 布局持久化键名           → 搜 `layoutPersistKey`
 * 2) 整页最大宽、边距、间距   → 搜 `shell` | `splitters` | `header` | `footer` | `articlePadding` | `settingsModal`
 * 3) 左右栏宽、上下分栏比例   → 搜 `mainColumn` | `leftSplit` | `rightSplit` | `loudnessHistMetrics`
 * 4) 模块最小高度、纵轴宽度   → 搜 `heightsRem` | `widthsPx`
 * 5) 全局字体、字号九档       → 搜 `typography`（title / section / axisValue / axisUnit / extraValue / metricMeta / metricValue / action / status）
 * 6) 圆角                      → 搜 `radii`
 * 7) 深色 / 浅色「整页配色」   → 搜 `DARK_THEME_COLORS` 或 `LIGHT_THEME_COLORS`
 * 8) 浅色下单独加深曲线颜色   → 搜 `themes:` 里 `light:` 下的 `charts` / `spectrumGrid`
 * 9) 图表线宽、默认描边色、Vectorscope 轨迹比例 → 搜 `charts:` / `plotRadius`（与主题里覆盖合并）
 * 10) 谱图底网、表盘渐变      → 搜 `spectrumGrid` | `meterGradient`
 * 11) 右侧 Metrics 列宽       → 搜 `loudnessMetrics`
 * 12) 历史窗默认秒数          → 搜 `history`
 *
 * 调试技巧：浏览器 DevTools → 选中 `<html>` → 看「Computed」里以 `--ui-` 开头的变量是否已变。
 *
 * 主题机制：`applyUiPreferencesToDocument(prefs, uiMode)` 把当前主题的 `colors` 等写入 CSS 变量；
 * `main.jsx` 首屏按 localStorage 的 `uiMode` 调一次；`App.jsx` 在 `uiMode` 变化时再调。
 * `layoutPersistKey` 勿随意改名（与已存 localStorage 键一致）。
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

/** 深色主题：页面/面板/文字/Peak 线/图例/设置弹层等（写入 --ui-color-*） */
const DARK_THEME_COLORS = {
  pageBg: "#111827", // 整页最外背景
  textPrimary: "#f3f4f6", // 主标题、正文高对比字
  textSecondary: "#d1d5db", // 次要说明
  textMuted: "#9ca3af", // 再弱一级（小节标题、刻度感）
  textSubtle: "#6b7280", // Metrics 标签等更淡字
  panelBg: "#1f2937", // 各模块圆角卡片背景（Peak、History…）
  panelBgSplitter: "rgba(31, 41, 55, 0.8)", // 可拖拽分割条背景
  insetBg: "#111827", // 图表深底（spectrum-grid 区域）
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
  loudnessTargetLine: "rgba(251, 191, 36, 0.7)", // History 里目标 LUFS 虚线
  snapshotRing: "rgba(251, 191, 36, 0.5)", // 时停时 Spectrum/Vector 外圈
  snapshotBadgeBg: "rgba(251, 191, 36, 0.15)", // 「Snapshot View」徽章底
  snapshotBadgeText: "#fde68a", // 徽章字色
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
  targetValue: "#fcd34d", // 目标 LUFS 数字
};

/** 浅色主题：语义与 DARK_THEME_COLORS 一一对应，数值为浅底可读配色 */
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
  metricRowBg: "rgba(255, 255, 255, 0.55)",
  metricRowBorder: "rgba(148, 163, 184, 0.5)",
  metricRowHoverBg: "rgba(248, 250, 252, 0.92)",
  metricRowToggleOnBg: "rgba(219, 234, 254, 0.72)",
  metricRowToggleOnBorder: "#2563eb",
  metricRowToggleOnGlow: "rgba(37, 99, 235, 0.25)",
  metricLabelText: "#64748b",
  metricValueText: "#0f172a",
  metricUnitText: "#475569",
  metricToggleOnLabelText: "#1e40af",
  metricToggleOnUnitText: "#1d4ed8",
  targetLabel: "#4b5563",
  targetValue: "#b45309",
};

export const UI_PREFERENCES = {
  // 与 Settings 里「布局+主题」一起写入 localStorage；改名会导致旧配置读不到
  layoutPersistKey: "am.react.layout.v1",

  // 最外层容器：最大宽度、页面边距、主纵向间距（rem）
  shell: {
    maxWidthPx: 1600, // 内容区 max-width，再大两侧留白
    paddingRem: { base: 0.8, lg: 1.2}, // 小屏 / lg 以上整页内边距
    gapRem: { base: 0.5, lg: 0.5 }, // header、main、footer 之间的缝
  },

  // section 间距与分栏条粗细（px）
  splitters: {
    sectionGapPx: 8, // 所有 section 间距统一值
    barThicknessPx: 1, // 分栏条可视粗细
  },

  // 顶栏 AudioMeter 一行：左右内边距（rem）
  header: {
    paddingXRem: 1.0,
    paddingYRem: 0.75,
  },

  // 底栏状态行：左右 / 上下内边距（rem）
  footer: {
    paddingXRem: 1,
    paddingYRem: 0.5,
  },

  // 各 article 卡片内边距：默认可分 x/y；Metrics 列表单独控制（rem）
  articlePadding: {
    defaultXRem: 0.7,
    defaultYRem: 0.5,
    metricsRem: 0, // Metrics 条目列表内边距（标题仍跟随 defaultRem）
    sectionTitleGapRem: 0.4, // 常规模块标题与内容间距
    metricsTitleGapRem: 0.4, // Metrics 模块标题与列表间距
  },

  // 常用细粒度间距（rem）：避免 JSX 里硬编码 mt/gap/pb 导致配置失效
  spacingRem: {
    // Global
    headerActionGap: 0, // 顶栏右侧按钮间距（原 gap-2）
    panelFooterGap: 0.4, // 模块主体与底部信息条之间（原 mt-2）
    inlineValueGap: 0.4, // 模块内同一行数值组间距（原 gap-2）
    
    // Metrics
    metricsListGap: 0.45, // Metrics 条目间距（原 gap-1）
    metricDotSize: 0.6, // Metrics 可切换条目前的小圆点（原 h-2 w-2）
    
    // Shared chart axes (History / Spectrum)
    axisGapX: 0.4, // 横轴刻度与图表间距（History/Spectrum 共用）
    axisGapY: 0.4, // 纵轴刻度与图表间距（History/Spectrum 共用）
    
    // Peak Meter
    peakAxisChartGap: 0.5, // Peak 纵轴刻度列与柱图区之间间距
    peakChannelGap: 0.4, // Peak 柱与柱之间间距（N 声道时为 N-1 个 gap）
    peakDisplayTopInset: 0.5, // Peak 显示区顶部边界（刻度与柱体共用）
    peakDisplayBottomInset: 0.5, // Peak 显示区底部边界（刻度与柱体共用）
    meterChartInsetX: 0.6, // L/R 柱图左右内缩（原 inset-x-3）
    meterLabelLeftInset: 1.6, // L/R 标题左侧内缩（仅正数，越大越靠右）
    meterLabelTopInset: 0.75, // L/R 标题顶部定位（原 top-3）
    tpInfoLeftBlank: 5.4, // Peak 信息行 TP MAX 左侧留白

    // Vectorscope
    chartOuterInset: 0, // Vectorscope 绘图区外边距（原 inset-4）
    vectorCornerInset: 0.4, // Vectorscope 四角标注偏移（原 left/right/top/bottom-2）
    corrInfoLeftBlank: 4, // Vectorscope 信息行 CORRELATION 左侧留白

    // History
    historyDisplayTopInset: 0.1, // History 显示区顶部边界（左轴与图线共用）
    historyDisplayBottomInset: 0, // History 显示区底部边界（左轴与图线共用）
    historySvgPad: 0.4, // History 主图 SVG 内边距（原 p-3）
    hudInset: 0.25, // History HUD 角落偏移（原 bottom-1/right-1）

    // Spectrum
    spectrumDisplayTopInset: 0, // Spectrum 显示区顶部边界（左轴与图线共用）
    spectrumDisplayBottomInset: 0, // Spectrum 显示区底部边界（左轴与图线共用）
    spectrumSvgPad: 0.4, // Spectrum 主图 SVG 内边距（原 p-2）

    // Shared badges
    snapshotBadgeInset: 0.5, // Snapshot 徽章右上偏移（原 right-2/top-2）
  },

  // 设置弹窗：最大宽、内边距、遮罩内边距（rem）
  settingsModal: {
    maxWidthRem: 28,
    paddingRem: 1.25,
    overlayPaddingRem: 1,
    headerGapRem: 1.25, // Settings 标题行与内容区间距（原 mb-5）
    contentGapRem: 1, // Settings 各配置行垂直间距（原 gap-4）
    inlineGapRem: 0.5, // Theme 按钮组横向间距（原 gap-2）
    actionPadXRem: 0.75, // Close/Reset 按钮水平内边距（原 px-3）
    actionPadYRem: 0.25, // Close/Reset 按钮垂直内边距（原 py-1）
  },

  // 主布局：左侧「Peak + Vector」一栏的宽度（px）及中间竖条拖拽范围
  mainColumn: {
    initialPx: 270, // 默认左栏宽
    dragMinPx: 240, // 拖窄极限
    dragMaxPx: 360, // 拖宽极限
  },

  // 左栏内：Peak Meter 占上方高度比例（0~1），余下给 Vectorscope
  leftSplit: {
    initialRatio: 0.6, // 默认
    dragMinRatio: 0.5, // 上下拖动的比例下限
    dragMaxRatio: 0.72,
    dragPixelsPerDelta: 500, // 越大同样鼠标位移变化越小（手感更「钝」）
  },

  // 右栏内：Loudness（History+Metrics）区 vs Spectrum 的上下分割
  rightSplit: {
    initialRatio: 0.5, // 默认：上面 Loudness 区约 48% 高
    dragMinRatio: 0.34,
    dragMaxRatio: 0.76,
    dragPixelsPerDelta: 650,
  },

  // 右栏 Loudness 一行内：History 宽度占行宽比例（0~1），余下给 Metrics
  loudnessHistMetrics: {
    initialRatio: 0.65, // 默认 History 约 64%，Metrics 约 36%
    dragMinRatio: 0.5,
    dragMaxRatio: 0.88,
    dragPixelsPerDelta: 720,
  },

  // 各模块最小高度（rem），防止拖得太扁看不见
  heightsRem: {
    peakModuleMin: 12, // Peak 整块
    historyModuleMin: 10, // Loudness History 整块（含轴与底栏）
    spectrumModuleMin: 10, // Spectrum 整块
    historyChartMin: 8, // 仅中间曲线区域最小高
    spectrumFreqRowRem: 1.25, // Spectrum 下方频率刻度行高
  },

  // 纵轴刻度列宽度（px）：响度左轴、频谱左轴、Peak 刻度列
  widthsPx: {
    loudnessYAxis: 24,
    spectrumYAxis: 24,
    peakTickCol: 24,
  },

  /**
   * 字号九档（px）：按语义分层，避免同一字号混用在不同行为上。
   * 1) title 2) section 3) axisValue 4) axisUnit 5) extraValue
   * 6) metricMeta 7) metricValue 8) action 9) status
   */
  typography: {
    fontFamily: 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    sizesPx: {
      title: 20, // 顶栏大标题
      section: 12, // 各模块标题、Settings 标题
      axisValue: 12, // 坐标轴刻度数字、时间轴刻度
      axisUnit: 11, // 坐标轴单位（LUFS / dB / Hz）
      extraValue: 13, // TP MAX / Correlation / Target 等模块补充信息
      metricMeta: 14, // Loudness Metrics 参数名与单位；Settings 条目文本
      metricValue: 18, // Loudness Metrics 数值
      action: 14, // Start/Clear/Settings、图例药丸、Snapshot 徽章等按钮/操作文案
      status: 12, // 底部状态栏
    },
    weights: {
      appTitle: 800,
      section: 600,
    },
  },

  // 圆角：卡片、弹窗、药丸、Metrics 行
  radii: {
    card: "0.75rem",
    modal: "1rem",
    pill: "9999px",
    metricRow: "0.375rem",
  },

  // 深色 / 浅色：各自一套 colors；light 里多写的 charts / spectrumGrid 会与下面全局 charts 等合并
  themes: {
    dark: {
      colors: DARK_THEME_COLORS,
    },
    light: {
      colors: LIGHT_THEME_COLORS,
      charts: {
        loudnessHistory: {
          momentaryStroke: "#0e7490", // 浅底上略加深的 Momentary 线
          shortTermStroke: "#1d4ed8",
          selectionStroke: "#c2410c", // 时停竖线 / 选区
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
        verticalLineOpacity: 0.07, // 浅底上网格略明显一点
        horizontalLineOpacity: 0.05,
      },
    },
  },

  // 深色默认下的曲线：颜色 + 线宽 + 透明度（浅色在 themes.light.charts 里覆盖颜色）
  charts: {
    loudnessHistory: {
      momentaryStroke: "#22d3ee",
      momentaryStrokeWidth: 2.2,
      shortTermStroke: "#007AFF",
      shortTermStrokeWidth: 2.6,
      shortTermOpacity: 0.95,
      selectionStrokeWidth: 1.2, // 时停选点竖线
    },
    vectorscope: {
      strokeLive: "#22d3ee", // 实时轨迹
      strokeSnap: "#f59e0b", // 时停
      strokeWidth: 1.2,
      axisOpacity: 0.8, // 轨迹透明度
      gridDiagInsetPct: 1.2, // 米字斜线端点离边缘内缩百分比（避免圆角处越界）
      /** viewBox 260×260、中心 130：L/R 限幅 ±1 经 M/S 映射后，从中心到轨迹边缘的「半径」SVG 单位（原默认 96） */
      plotRadius: 240,
    },
    spectrum: {
      strokeLive: "#007AFF",
      strokeSnap: "#f59e0b",
      strokeWidth: 3,
    },
  },

  // History / Spectrum 图底下的淡网格（透明度 + 线距 px）
  spectrumGrid: {
    verticalLineOpacity: 0.04,
    horizontalLineOpacity: 0.03,
    verticalSpacingPx: 56,
    horizontalSpacingPx: 34,
  },

  // Peak 表盘竖向三色渐变（上→中→下）
  meterGradient: {
    top: "#ef4444",
    mid: "#f59e0b",
    midStopPercent: 40, // 中间色停在渐变高度的百分比
    bottom: "#22c55e",
  },

  // 响度历史默认时间窗（秒）；Clear、右键双击重置等与此一致
  history: {
    defaultWindowSec: 120,
  },

  // 右侧 Metrics：数值列宽(ch)、单位列宽(rem)、行高与内边距
  loudnessMetrics: {
    valueColumnCh: 7, // 等宽数字列，影响小数点对齐
    unitColumnRem: 3.5,
    rowMinHeightRem: 2.5,
    rowPaddingXRem: 0.625,
    rowPaddingYRem: 0.375,
    rowGapRem: 0.5,
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
  const charts = mergeCharts(prefs.charts, theme.charts);
  const spectrumGrid = mergeShallow(prefs.spectrumGrid, theme.spectrumGrid);
  const meterGradient = mergeShallow(prefs.meterGradient, theme.meterGradient);
  const { typography, radii, shell, heightsRem, widthsPx } = prefs;

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
  setCssVar("--ui-color-snapshot-ring", colors.snapshotRing);
  setCssVar("--ui-color-snapshot-badge-bg", colors.snapshotBadgeBg);
  setCssVar("--ui-color-snapshot-badge-text", colors.snapshotBadgeText);
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

  setCssVar("--ui-section-gap", `${prefs.splitters.sectionGapPx}px`);
  // splitters track size drives actual section spacing
  setCssVar("--ui-splitter-main", `${prefs.splitters.sectionGapPx}px`);
  setCssVar("--ui-splitter-row", `${prefs.splitters.sectionGapPx}px`);
  setCssVar("--ui-splitter-hm", `${prefs.splitters.sectionGapPx}px`);
  // visual splitter bar thickness inside the track
  setCssVar("--ui-splitter-bar-thickness", `${prefs.splitters.barThicknessPx}px`);

  const lm = prefs.loudnessMetrics;
  setCssVar("--ui-metric-row-min-h", `${lm.rowMinHeightRem}rem`);
  setCssVar("--ui-metric-row-pad-x", `${lm.rowPaddingXRem}rem`);
  setCssVar("--ui-metric-row-pad-y", `${lm.rowPaddingYRem}rem`);
  setCssVar("--ui-metric-row-gap", `${lm.rowGapRem}rem`);

  const h = prefs.header;
  setCssVar("--ui-header-pad-x", `${h.paddingXRem}rem`);
  setCssVar("--ui-header-pad-y", `${h.paddingYRem}rem`);

  const a = prefs.articlePadding;
  setCssVar("--ui-article-pad-x", `${a.defaultXRem}rem`);
  setCssVar("--ui-article-pad-y", `${a.defaultYRem}rem`);
  setCssVar("--ui-article-pad-metrics", `${a.metricsRem}rem`);
  setCssVar("--ui-section-title-gap", `${a.sectionTitleGapRem}rem`);
  setCssVar("--ui-metrics-title-gap", `${a.metricsTitleGapRem}rem`);

  const sp = prefs.spacingRem;
  setCssVar("--ui-panel-footer-gap", `${sp.panelFooterGap}rem`);
  setCssVar("--ui-metrics-list-gap", `${sp.metricsListGap}rem`);
  setCssVar("--ui-axis-gap-x", `${sp.axisGapX}rem`);
  setCssVar("--ui-header-action-gap", `${sp.headerActionGap}rem`);
  setCssVar("--ui-inline-value-gap", `${sp.inlineValueGap}rem`);
  setCssVar("--ui-tp-info-left-blank", `${sp.tpInfoLeftBlank}rem`);
  setCssVar("--ui-corr-info-left-blank", `${sp.corrInfoLeftBlank}rem`);
  setCssVar("--ui-axis-gap-y", `${sp.axisGapY}rem`);
  setCssVar("--ui-peak-axis-chart-gap", `${sp.peakAxisChartGap}rem`);
  setCssVar("--ui-peak-channel-gap", `${sp.peakChannelGap}rem`);
  setCssVar("--ui-metric-dot-size", `${sp.metricDotSize}rem`);
  setCssVar("--ui-peak-display-top-inset", `${sp.peakDisplayTopInset}rem`);
  setCssVar("--ui-peak-display-bottom-inset", `${sp.peakDisplayBottomInset}rem`);
  setCssVar("--ui-meter-chart-inset-x", `${sp.meterChartInsetX}rem`);
  setCssVar("--ui-meter-label-left-inset", `${sp.meterLabelLeftInset}rem`);
  setCssVar("--ui-meter-label-top-inset", `${sp.meterLabelTopInset}rem`);
  setCssVar("--ui-snapshot-badge-inset", `${sp.snapshotBadgeInset}rem`);
  setCssVar("--ui-chart-outer-inset", `${sp.chartOuterInset}rem`);
  setCssVar("--ui-vector-corner-inset", `${sp.vectorCornerInset}rem`);
  setCssVar("--ui-history-display-top-inset", `${sp.historyDisplayTopInset}rem`);
  setCssVar("--ui-history-display-bottom-inset", `${sp.historyDisplayBottomInset}rem`);
  setCssVar("--ui-history-svg-pad", `${sp.historySvgPad}rem`);
  setCssVar("--ui-hud-inset", `${sp.hudInset}rem`);
  setCssVar("--ui-spectrum-display-top-inset", `${sp.spectrumDisplayTopInset}rem`);
  setCssVar("--ui-spectrum-display-bottom-inset", `${sp.spectrumDisplayBottomInset}rem`);
  setCssVar("--ui-spectrum-svg-pad", `${sp.spectrumSvgPad}rem`);

  const f = prefs.footer;
  setCssVar("--ui-footer-pad-x", `${f.paddingXRem}rem`);
  setCssVar("--ui-footer-pad-y", `${f.paddingYRem}rem`);

  const sm = prefs.settingsModal;
  setCssVar("--ui-settings-modal-max-w", `${sm.maxWidthRem}rem`);
  setCssVar("--ui-settings-modal-pad", `${sm.paddingRem}rem`);
  setCssVar("--ui-settings-overlay-pad", `${sm.overlayPaddingRem}rem`);
  setCssVar("--ui-settings-header-gap", `${sm.headerGapRem}rem`);
  setCssVar("--ui-settings-content-gap", `${sm.contentGapRem}rem`);
  setCssVar("--ui-settings-inline-gap", `${sm.inlineGapRem}rem`);
  setCssVar("--ui-settings-action-pad-x", `${sm.actionPadXRem}rem`);
  setCssVar("--ui-settings-action-pad-y", `${sm.actionPadYRem}rem`);

  const lh = charts.loudnessHistory;
  setCssVar("--ui-lh-stroke-m-w", String(lh.momentaryStrokeWidth));
  setCssVar("--ui-lh-stroke-st-w", String(lh.shortTermStrokeWidth));
  setCssVar("--ui-lh-stroke-st-op", String(lh.shortTermOpacity));
  setCssVar("--ui-lh-stroke-sel-w", String(lh.selectionStrokeWidth));

  const vs = charts.vectorscope;
  setCssVar("--ui-vs-stroke-w", String(vs.strokeWidth));
  setCssVar("--ui-vs-axis-op", String(vs.axisOpacity));

  const spectrum = charts.spectrum;
  setCssVar("--ui-sp-stroke-w", String(spectrum.strokeWidth));
}
