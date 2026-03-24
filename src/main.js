(function () {
  const AM = window.AM || (window.AM = {});

  function bindUi() {
    const btnEbu = document.getElementById('btnEbu');
    const btnStream = document.getElementById('btnStream');
    const startBtn = document.getElementById('startBtn');
    const resetBtn = document.getElementById('resetBtn');
    const themeBtn = document.getElementById('themeBtn');

    let lastStartMode = '';
    const updateThemeBtn = () => {
      if (!themeBtn || !AM.theme) return;
      const mode = AM.theme.uiMode === 'light' ? 'LIGHT' : 'DARK';
      themeBtn.textContent = 'THEME ' + mode;
    };
    const updateStartButton = () => {
      if (!startBtn) return;
      let mode = 'start';
      if (AM.state && AM.state.selectedHistOffset >= 0) {
        mode = 'live';
      } else if (AM.state && AM.state.S && AM.state.S.running) {
        mode = 'stop';
      }
      if (mode === lastStartMode) return;
      lastStartMode = mode;
      if (mode === 'live') {
        startBtn.textContent = 'LIVE';
        startBtn.className = 'hbtn on';
      } else if (mode === 'stop') {
        startBtn.textContent = 'STOP';
        startBtn.className = 'hbtn on';
      } else {
        startBtn.textContent = 'START';
        startBtn.className = 'hbtn off';
      }
    };
    AM.ui = AM.ui || {};
    AM.ui.updateStartButton = updateStartButton;

    if (btnEbu) btnEbu.addEventListener('click', () => AM.audio.setTgt('ebu'));
    if (btnStream) btnStream.addEventListener('click', () => AM.audio.setTgt('stream'));
    if (startBtn) startBtn.addEventListener('click', () => AM.audio.doToggle());
    if (resetBtn) resetBtn.addEventListener('click', () => AM.audio.doReset());
    if (themeBtn) {
      themeBtn.addEventListener('click', () => {
        if (AM.theme && AM.theme.toggleMode) AM.theme.toggleMode();
        updateThemeBtn();
      });
      updateThemeBtn();
    }
    updateStartButton();
  }

  function bootstrap() {
    if (AM.theme && AM.theme.applyUiTheme) AM.theme.applyUiTheme();
    bindUi();
    if (AM.layout && AM.layout.init) AM.layout.init();
    AM.renderLoop.initStatic();
    if (AM.renderers.history && AM.renderers.history.bindHistoryPointer) {
      AM.renderers.history.bindHistoryPointer(document.getElementById('hCvs'));
    }
  }

  bootstrap();
})();

