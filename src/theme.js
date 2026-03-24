(function () {
  const AM = window.AM || (window.AM = {});
  const MODE_STORAGE_KEY = 'audiometer.uiMode';

  const FONTS = {
    mono: '"Share Tech Mono"',
    condensed: '"Barlow Condensed"',
  };

  const UI_SIZES = {
    logo: '14px',
    toggleBtn: '11px',
    headerBtn: '10px',
    sectionLabel: '9px',
    readoutLabel: '9px',
    readoutValue: '19px',
    readoutValueCompact: '23px',
    readoutUnit: '9px',
    status: '10px',
  };

  const UI_MODES = {
    dark: {
      palette: {
        bg: '#060a0e',
        panel: '#090e14',
        border1: '#12202e',
        border2: '#1e3045',
        green: '#00e896',
        green2: '#00b870',
        green3: '#006040',
        amber: '#ffb828',
        red: '#ff4444',
        blue: '#4a80ff',
        cyan: '#20d4e8',
      },
      text: {
        body: '#8fb0c8',
        high: '#cce0f0',
        dim: '#284060',
        mid: '#4a6880',
      },
      sizes: UI_SIZES,
      colors: {
        sectionLabel: '#3a6080',
        readoutLabel: '#5a7a96',
        readoutValue: '#d8eefa',
        readoutUnit: '#3a5a74',
        status: '#3a6080',
        readoutBg: '#0a1420',
        readoutBorder: '#1a2d42',
        readoutOk: '#00f0a0',
        readoutWarn: '#ffc040',
        readoutBad: '#ff5050',
        splitterBg: '#0d1722',
        splitterLine: '#31485f',
      },
    },
    light: {
      palette: {
        bg: '#f5f8fc',
        panel: '#ffffff',
        border1: '#c7d2de',
        border2: '#b1c0cf',
        green: '#0b9968',
        green2: '#0a7d58',
        green3: '#086044',
        amber: '#c88712',
        red: '#d64545',
        blue: '#2b67d1',
        cyan: '#1b8ea3',
      },
      text: {
        body: '#38516b',
        high: '#16283b',
        dim: '#617b94',
        mid: '#4a6580',
      },
      sizes: UI_SIZES,
      colors: {
        sectionLabel: '#4f6882',
        readoutLabel: '#5d7590',
        readoutValue: '#1f3650',
        readoutUnit: '#607b96',
        status: '#4f6882',
        readoutBg: '#edf3fa',
        readoutBorder: '#c7d3e0',
        readoutOk: '#10976f',
        readoutWarn: '#c58a21',
        readoutBad: '#d84e4e',
        splitterBg: '#dbe5ef',
        splitterLine: '#9fb2c6',
      },
    },
  };

  const RENDER_MODES = {
    dark: {
      canvas: {
        bg: '#030608',
        panel: '#090e16',
        border: '#12202e',
      },
      meters: {
        tickLineMaj: '#12202e',
        tickLineDim: '#0d1720',
        tickText: '#2a4060',
        targetLine: '#4a80ff',
        clipLine: '#ff444422',
        targetGlow: '#4a80ff33',
        clipLabel: '#ff444490',
        labelDim: '#243a52',
        zeroLine: '#ff444450',
        dashedGrid: '#4a80ff',
        clipFillTop: '#ff4444',
        clipFillMid: '#ffb828',
        okFill: '#00e896',
        warnFill: '#e8c030',
        badFill: '#006848',
        peakLineBad: '#ff5555',
        peakLineWarn: '#ffc040',
        peakLineOk: '#00e896',
        barOutlineBad: '#ff7777',
        barOutlineWarn: '#ffd060',
        barOutlineOk: '#40ffb0',
        smallDimText: '#1e2d3e',
        smallText: '#6a90a8',
      },
      spectrum: {
        gridMaj: '#1a2d40',
        gridDim: '#0e1a25',
        zeroLine: '#ff444428',
        fillGrad1: '#ff444455',
        fillGrad2: '#ffb82838',
        fillGrad3: '#00e89650',
        fillGrad4: '#005c3818',
        stroke: '#00e896',
        strokeAge: '#00e89638',
        border: '#12202e',
        labelText: '#2a4060',
        zeroLabel: '#ff444480',
      },
      history: {
        bg: '#030608',
        grid: '#12202e',
        gridTarget: '#4a80ff28',
        gridZero: '#ff444428',
        targetLine: '#4a80ff',
        marker: '#20d4e8',
        markerDash: '#20d4e8',
        fillGrad1: '#4a80ff50',
        fillGrad2: '#4a80ff08',
        stroke: '#6090ff',
        secondaryStroke: '#89b4ff99',
        labelText: '#2a4060',
        timeLabelBg: '#1e3248',
      },
      vectorscope: {
        bg: '#030608',
        grid: '#12202e',
        axis: '#2a4060',
        trace: '#20d4e8',
        center: '#4a80ff',
        border: '#12202e',
        text: '#2a4060',
        corrGood: '#00e896',
        corrWarn: '#ffb828',
        corrBad: '#ff4444',
      },
    },
    light: {
      canvas: {
        bg: '#f4f8fd',
        panel: '#e9f0f8',
        border: '#c6d5e4',
      },
      meters: {
        tickLineMaj: '#c2d2e2',
        tickLineDim: '#d8e3ee',
        tickText: '#58728e',
        targetLine: '#2d68cf',
        clipLine: '#d84e4e44',
        targetGlow: '#2d68cf33',
        clipLabel: '#d84e4e90',
        labelDim: '#6a8197',
        zeroLine: '#d84e4e66',
        dashedGrid: '#2d68cf',
        clipFillTop: '#d84e4e',
        clipFillMid: '#c58a21',
        okFill: '#10976f',
        warnFill: '#d5a23c',
        badFill: '#83b7a2',
        peakLineBad: '#d84e4e',
        peakLineWarn: '#c58a21',
        peakLineOk: '#10976f',
        barOutlineBad: '#e06969',
        barOutlineWarn: '#d8ab4f',
        barOutlineOk: '#42ae8d',
        smallDimText: '#7f95aa',
        smallText: '#526b84',
      },
      spectrum: {
        gridMaj: '#c7d6e5',
        gridDim: '#dee8f1',
        zeroLine: '#d84e4e2e',
        fillGrad1: '#d84e4e33',
        fillGrad2: '#c58a2130',
        fillGrad3: '#10976f40',
        fillGrad4: '#10976f14',
        stroke: '#10976f',
        strokeAge: '#10976f44',
        border: '#c6d5e4',
        labelText: '#56718d',
        zeroLabel: '#d84e4e99',
      },
      history: {
        bg: '#f4f8fd',
        grid: '#c7d6e5',
        gridTarget: '#2d68cf2e',
        gridZero: '#d84e4e2e',
        targetLine: '#2d68cf',
        marker: '#1b8ea3',
        markerDash: '#1b8ea3',
        fillGrad1: '#2d68cf40',
        fillGrad2: '#2d68cf10',
        stroke: '#4f7fd4',
        secondaryStroke: '#6f95d699',
        labelText: '#56718d',
        timeLabelBg: '#e0eaf5',
      },
      vectorscope: {
        bg: '#f4f8fd',
        grid: '#c7d6e5',
        axis: '#5b7490',
        trace: '#1b8ea3',
        center: '#2d68cf',
        border: '#c6d5e4',
        text: '#5b7490',
        corrGood: '#10976f',
        corrWarn: '#c58a21',
        corrBad: '#d84e4e',
      },
    },
  };

  function freezeDeep(obj) {
    Object.freeze(obj);
    Object.getOwnPropertyNames(obj).forEach((key) => {
      const val = obj[key];
      if (val && typeof val === 'object' && !Object.isFrozen(val)) freezeDeep(val);
    });
    return obj;
  }

  freezeDeep(FONTS);
  freezeDeep(UI_SIZES);
  freezeDeep(UI_MODES);
  freezeDeep(RENDER_MODES);

  AM.theme = {
    fonts: FONTS,
    uiMode: 'dark',
    uiModes: UI_MODES,
    renderModes: RENDER_MODES,
    canvas: RENDER_MODES.dark.canvas,
    meters: RENDER_MODES.dark.meters,
    spectrum: RENDER_MODES.dark.spectrum,
    history: RENDER_MODES.dark.history,
    vectorscope: RENDER_MODES.dark.vectorscope,
  };

  AM.theme.applyUiTheme = function applyUiTheme() {
    const root = document.documentElement;
    if (!root) return;
    const th = AM.theme;
    const ui = th.uiModes[th.uiMode] || th.uiModes.dark;

    const cssVars = {
      '--font-ui': th.fonts.condensed,
      '--font-mono': th.fonts.mono,
      '--bg': ui.palette.bg,
      '--panel': ui.palette.panel,
      '--b1': ui.palette.border1,
      '--b2': ui.palette.border2,
      '--green': ui.palette.green,
      '--green2': ui.palette.green2,
      '--green3': ui.palette.green3,
      '--amber': ui.palette.amber,
      '--red': ui.palette.red,
      '--blue': ui.palette.blue,
      '--cyan': ui.palette.cyan,
      '--txt': ui.text.body,
      '--hi': ui.text.high,
      '--dim': ui.text.dim,
      '--mid': ui.text.mid,
      '--size-logo': ui.sizes.logo,
      '--size-toggle-btn': ui.sizes.toggleBtn,
      '--size-header-btn': ui.sizes.headerBtn,
      '--size-section-label': ui.sizes.sectionLabel,
      '--size-readout-label': ui.sizes.readoutLabel,
      '--size-readout-value': ui.sizes.readoutValue,
      '--size-readout-value-compact': ui.sizes.readoutValueCompact,
      '--size-readout-unit': ui.sizes.readoutUnit,
      '--size-status': ui.sizes.status,
      '--color-section-label': ui.colors.sectionLabel,
      '--color-readout-label': ui.colors.readoutLabel,
      '--color-readout-value': ui.colors.readoutValue,
      '--color-readout-unit': ui.colors.readoutUnit,
      '--color-status': ui.colors.status,
      '--color-readout-bg': ui.colors.readoutBg,
      '--color-readout-border': ui.colors.readoutBorder,
      '--color-readout-ok': ui.colors.readoutOk,
      '--color-readout-warn': ui.colors.readoutWarn,
      '--color-readout-bad': ui.colors.readoutBad,
      '--color-splitter-bg': ui.colors.splitterBg,
      '--color-splitter-line': ui.colors.splitterLine,
    };

    Object.entries(cssVars).forEach(([key, val]) => root.style.setProperty(key, val));
  };

  AM.theme.applyRenderTheme = function applyRenderTheme() {
    const th = AM.theme;
    const rm = th.renderModes[th.uiMode] || th.renderModes.dark;
    th.canvas = rm.canvas;
    th.meters = rm.meters;
    th.spectrum = rm.spectrum;
    th.history = rm.history;
    th.vectorscope = rm.vectorscope;
  };

  AM.theme.setMode = function setMode(mode) {
    if (!AM.theme.uiModes[mode] || !AM.theme.renderModes[mode]) return false;
    AM.theme.uiMode = mode;
    AM.theme.applyUiTheme();
    AM.theme.applyRenderTheme();
    if (AM.renderLoop && AM.renderLoop.initStatic) AM.renderLoop.initStatic();
    try {
      window.localStorage.setItem(MODE_STORAGE_KEY, mode);
    } catch (_e) {
      // Ignore storage errors (private mode, blocked storage, etc.)
    }
    return true;
  };

  AM.theme.toggleMode = function toggleMode() {
    return AM.theme.setMode(AM.theme.uiMode === 'dark' ? 'light' : 'dark');
  };

  AM.theme.loadSavedMode = function loadSavedMode() {
    try {
      const saved = window.localStorage.getItem(MODE_STORAGE_KEY);
      if (saved && AM.theme.uiModes[saved] && AM.theme.renderModes[saved]) {
        AM.theme.uiMode = saved;
      }
    } catch (_e) {
      // Ignore storage read errors and keep default mode.
    }
  };

  AM.theme.loadSavedMode();
  AM.theme.setMode(AM.theme.uiMode);
})();

