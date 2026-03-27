(function () {
  const AM = window.AM || (window.AM = {});

  function bindUi() {
    const loudnessStandardSel = document.getElementById('loudnessStandardSel');
    const startBtn = document.getElementById('startBtn');
    const resetBtn = document.getElementById('resetBtn');
    const themeDarkBtn = document.getElementById('themeDarkBtn');
    const themeLightBtn = document.getElementById('themeLightBtn');
    const settingsBtn = document.getElementById('settingsBtn');
    const settingsOverlay = document.getElementById('settingsOverlay');
    const settingsPanel = document.getElementById('settingsPanel');
    const settingsCloseBtn = document.getElementById('settingsCloseBtn');

    let lastStartMode = '';
    const updateThemeToggle = () => {
      if (!themeDarkBtn || !themeLightBtn || !AM.theme) return;
      const isLight = AM.theme.uiMode === 'light';
      themeDarkBtn.classList.toggle('on', !isLight);
      themeLightBtn.classList.toggle('on', isLight);
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

    if (loudnessStandardSel) {
      loudnessStandardSel.addEventListener('change', () => {
        AM.audio.setTgt(loudnessStandardSel.value);
      });
    }
    if (startBtn) startBtn.addEventListener('click', () => AM.audio.doToggle());
    if (resetBtn) resetBtn.addEventListener('click', () => AM.audio.doClear());
    if (themeDarkBtn) {
      themeDarkBtn.addEventListener('click', () => {
        if (AM.theme && AM.theme.setMode) AM.theme.setMode('dark');
        updateThemeToggle();
      });
    }
    if (themeLightBtn) {
      themeLightBtn.addEventListener('click', () => {
        if (AM.theme && AM.theme.setMode) AM.theme.setMode('light');
        updateThemeToggle();
      });
    }
    updateThemeToggle();

    function setSettingsOpen(open) {
      if (!settingsOverlay || !settingsBtn) return;
      settingsOverlay.classList.toggle('open', open);
      settingsOverlay.setAttribute('aria-hidden', open ? 'false' : 'true');
      settingsBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (open && settingsPanel) settingsPanel.focus();
    }
    function closeSettings() {
      setSettingsOpen(false);
    }
    if (settingsBtn) {
      settingsBtn.addEventListener('click', () => {
        setSettingsOpen(!settingsOverlay.classList.contains('open'));
      });
    }
    if (settingsOverlay) {
      settingsOverlay.addEventListener('click', (e) => {
        if (e.target === settingsOverlay) closeSettings();
      });
    }
    if (settingsPanel) {
      settingsPanel.addEventListener('click', (e) => e.stopPropagation());
    }
    if (settingsCloseBtn) settingsCloseBtn.addEventListener('click', closeSettings);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && settingsOverlay && settingsOverlay.classList.contains('open')) {
        closeSettings();
      }
    });

    updateStartButton();

    function syncHistToggleUi(btnId, pressed) {
      const btn = document.getElementById(btnId);
      if (!btn) return;
      btn.classList.toggle('on', pressed);
      btn.setAttribute('aria-pressed', pressed ? 'true' : 'false');
    }

    function bindHistToggles() {
      const pairs = [
        ['m', 'histTglM'],
        ['st', 'histTglST'],
        ['int', 'histTglInt'],
      ];
      for (const [key, id] of pairs) {
        const btn = document.getElementById(id);
        if (!btn) continue;
        btn.addEventListener('click', () => {
          const on = AM.state.toggleHistCurve(key);
          syncHistToggleUi(id, on);
        });
      }
    }
    bindHistToggles();
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

