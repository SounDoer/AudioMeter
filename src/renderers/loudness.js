(function () {
  const AM = window.AM || (window.AM = {});
  const th = AM.theme;
  AM.renderers = AM.renderers || {};

  function getHistoryPadT() {
    try {
      const raw = getComputedStyle(document.documentElement).getPropertyValue('--loudness-history-pad-top').trim();
      const n = parseFloat(raw);
      return isFinite(n) ? n : 28;
    } catch (_) {
      return 28;
    }
  }

  function drawHistory(cvs) {
    const dpr = window.devicePixelRatio || 1;
    const PADT = getHistoryPadT();
    const rdEl = document.getElementById('rdouts');
    if (rdEl) {
      const padTop = Math.round(PADT);
      if (rdEl.dataset.loudPad !== String(padTop)) {
        rdEl.dataset.loudPad = String(padTop);
        rdEl.style.paddingTop = padTop + 'px';
      }
    }
    const hw = document.getElementById('hWrap');
    if (hw && rdEl) {
      void rdEl.offsetHeight;
      const rh = Math.round(rdEl.getBoundingClientRect().height);
      if (rh > 0) hw.style.height = rh + 'px';
    }

    const W = cvs.offsetWidth;
    const H = cvs.offsetHeight;
    if (!W || !H) return;

    if (cvs.width !== Math.round(W * dpr) || cvs.height !== Math.round(H * dpr)) {
      cvs.width = Math.round(W * dpr);
      cvs.height = Math.round(H * dpr);
    }

    const ctx = cvs.getContext('2d');
    ctx.save();
    ctx.scale(dpr, dpr);

    const S = AM.state.S;
    const tgt = S.target;
    const histBuf = AM.state.histBuf;
    const histHead = AM.state.histHead;
    const histCount = AM.state.histCount;

    const PADL = 42;
    const PADR = 6;
    const PADB = 18;
    const CW = W - PADL - PADR;
    const CH = H - PADT - PADB;

    const DBMIN = -60;
    const DBMAX = 3;
    const DBRNG = DBMAX - DBMIN;

    function dToY(d) {
      const dd = Math.max(DBMIN, Math.min(DBMAX, d));
      return PADT + (1 - (dd - DBMIN) / DBRNG) * CH;
    }

    ctx.fillStyle = th.history.bg;
    ctx.fillRect(0, 0, W, H);

    for (const d of [-60, -48, -36, -24, -18, -12, -6, 0, 3]) {
      const y = dToY(d);
      ctx.strokeStyle = Math.abs(d - tgt) < 0.1 ? th.history.gridTarget : d === 0 ? th.history.gridZero : th.history.grid;
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(PADL, y);
      ctx.lineTo(PADL + CW, y);
      ctx.stroke();
    }

    // Target line
    ctx.strokeStyle = th.history.targetLine;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(PADL, dToY(tgt));
    ctx.lineTo(PADL + CW, dToY(tgt));
    ctx.stroke();
    ctx.setLineDash([]);

    // History graph line
    if (histCount > 1) {
      const n = Math.min(histCount, CW * 4);
      const pxPerSamp = CW / n;
      const sampPer30 = 300;

      ctx.font = '9px ' + th.fonts.condensed;
      ctx.fillStyle = th.history.timeLabelBg;
      ctx.textAlign = 'center';

      for (let i = 0; i * sampPer30 < n; i++) {
        const sampFromEnd = i * sampPer30;
        const px = CW - sampFromEnd * pxPerSamp;
        if (px < 0 || px > CW) continue;

        ctx.strokeStyle = th.history.grid;
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(PADL + px, PADT);
        ctx.lineTo(PADL + px, PADT + CH);
        ctx.stroke();

        const secs = i * 30;
        const lbl = secs >= 60 ? Math.floor(secs / 60) + 'm' + (secs % 60 ? secs % 60 + 's' : '') : secs + 's';
        ctx.fillStyle = th.history.labelText;
        ctx.fillText(lbl, PADL + px, H - 4);
      }

      const pts = [];
      for (let i = 0; i < n; i++) {
        const idx = (histHead - n + i + AM.state.HIST_MAX) % AM.state.HIST_MAX;
        const v = histBuf[idx];
        const px = (i / (n - 1)) * CW;
        if (isFinite(v)) pts.push({ px, v });
      }

      if (pts.length > 1) {
        ctx.beginPath();
        ctx.moveTo(PADL + pts[0].px, PADT + CH);
        for (const p of pts) ctx.lineTo(PADL + p.px, dToY(p.v));
        ctx.lineTo(PADL + pts[pts.length - 1].px, PADT + CH);
        ctx.closePath();

        const gf = ctx.createLinearGradient(0, PADT, 0, PADT + CH);
        gf.addColorStop(0, th.history.fillGrad1);
        gf.addColorStop(1, th.history.fillGrad2);
        ctx.fillStyle = gf;
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(PADL + pts[0].px, dToY(pts[0].v));
        for (const p of pts) ctx.lineTo(PADL + p.px, dToY(p.v));
        ctx.strokeStyle = th.history.stroke;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      const mPts = [];
      const mHistBuf = AM.state.mHistBuf;
      for (let i = 0; i < n; i++) {
        const idx = (histHead - n + i + AM.state.HIST_MAX) % AM.state.HIST_MAX;
        const v = mHistBuf[idx];
        const px = (i / (n - 1)) * CW;
        if (isFinite(v)) mPts.push({ px, v });
      }
      if (mPts.length > 1) {
        ctx.beginPath();
        ctx.moveTo(PADL + mPts[0].px, dToY(mPts[0].v));
        for (const p of mPts) ctx.lineTo(PADL + p.px, dToY(p.v));
        ctx.strokeStyle = th.history.secondaryStroke;
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      if (isFinite(S.integrated)) {
        const iy = dToY(S.integrated);
        ctx.strokeStyle = th.history.marker;
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 4]);
        ctx.beginPath();
        ctx.moveTo(PADL, iy);
        ctx.lineTo(PADL + CW, iy);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.font = '8px ' + th.fonts.mono;
        ctx.fillStyle = th.history.marker;
        ctx.textAlign = 'left';
        ctx.fillText('INT ' + S.integrated.toFixed(1), PADL + 4, iy - 3);
      }
    }

    ctx.strokeStyle = th.history.grid;
    ctx.lineWidth = 1;
    ctx.strokeRect(PADL, PADT, CW, CH);

    ctx.font = '8px ' + th.fonts.mono;
    ctx.textAlign = 'right';
    for (const d of [-48, -36, -24, -18, -12, -6, 0]) {
      const y = dToY(d);
      if (y < PADT || y > PADT + CH) continue;
      ctx.fillStyle = th.history.labelText;
      ctx.fillText(d.toString(), PADL - 4, y + 3);
    }

    ctx.restore();
  }

  AM.renderers.history = {
    drawHistory,
  };
})();
