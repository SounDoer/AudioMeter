(function () {
  const AM = window.AM || (window.AM = {});

  function bindUi() {
    const btnEbu = document.getElementById('btnEbu');
    const btnStream = document.getElementById('btnStream');
    const startBtn = document.getElementById('startBtn');
    const resetBtn = document.getElementById('resetBtn');

    if (btnEbu) btnEbu.addEventListener('click', () => AM.audio.setTgt('ebu'));
    if (btnStream) btnStream.addEventListener('click', () => AM.audio.setTgt('stream'));
    if (startBtn) startBtn.addEventListener('click', () => AM.audio.doToggle());
    if (resetBtn) resetBtn.addEventListener('click', () => AM.audio.doReset());
  }

  function bootstrap() {
    bindUi();
    AM.renderLoop.initStatic();
    AM.audio.loadDevices();
  }

  bootstrap();
})();

