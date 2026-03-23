(function () {
  const AM = window.AM || (window.AM = {});
  const th = AM.theme;

  let raf = null;

  function stopLoop() {
    if (raf) {
      cancelAnimationFrame(raf);
      raf = null;
    }
  }

  function initStatic() {
    requestAnimationFrame(() => {
      const mc = document.getElementById('mCvs');
      if (mc && AM.renderers.meters) AM.renderers.meters.drawMeters(mc);

      for (const id of ['sCvs', 'hCvs']) {
        const cvs = document.getElementById(id);
        if (!cvs) continue;
        const dpr = window.devicePixelRatio || 1;
        const W = cvs.offsetWidth;
        const H = cvs.offsetHeight;
        if (!W || !H) continue;
        cvs.width = Math.round(W * dpr);
        cvs.height = Math.round(H * dpr);
        const ctx = cvs.getContext('2d');
        ctx.fillStyle = th.canvas.bg;
        ctx.fillRect(0, 0, W, H);
      }
    });
  }

  function startLoop() {
    const mc = document.getElementById('mCvs');
    const sc = document.getElementById('sCvs');
    const hc = document.getElementById('hCvs');
    if (!mc || !sc || !hc) return;

    stopLoop();

    function frame() {
      raf = requestAnimationFrame(frame);

      if (AM.renderers.meters) AM.renderers.meters.drawMeters(mc);

      if (AM.runtime.ansr) {
        if (AM.renderers.spectrum) AM.renderers.spectrum.drawSpectrum(sc, AM.runtime.ansr);
      } else {
        const dpr = window.devicePixelRatio || 1;
        const ctx = sc.getContext('2d');
        ctx.fillStyle = th.canvas.bg;
        ctx.fillRect(0, 0, sc.width / dpr, sc.height / dpr);
      }

      if (AM.renderers.history) AM.renderers.history.drawHistory(hc);
      if (AM.ui.updateReadouts) AM.ui.updateReadouts();
    }

    frame();
  }

  AM.renderLoop = {
    startLoop,
    stopLoop,
    initStatic,
  };
})();

