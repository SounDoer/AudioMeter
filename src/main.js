(function () {
  const AM = window.AM || (window.AM = {});

  function bindUi() {
    const btnEbu = document.getElementById('btnEbu');
    const btnStream = document.getElementById('btnStream');
    const startBtn = document.getElementById('startBtn');
    const resetBtn = document.getElementById('resetBtn');
    const themeBtn = document.getElementById('themeBtn');

    const updateThemeBtn = () => {
      if (!themeBtn || !AM.theme) return;
      const mode = AM.theme.uiMode === 'light' ? 'LIGHT' : 'DARK';
      themeBtn.textContent = 'THEME ' + mode;
    };

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
  }

  function bootstrap() {
    if (AM.theme && AM.theme.applyUiTheme) AM.theme.applyUiTheme();
    bindUi();
    if (AM.layout && AM.layout.init) AM.layout.init();
    AM.renderLoop.initStatic();
  }

  bootstrap();
})();

