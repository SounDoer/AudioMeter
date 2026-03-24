(function () {
  const AM = window.AM || (window.AM = {});
  const th = AM.theme;
  AM.renderers = AM.renderers || {};

  function drawHistory(cvs) {
    const dpr = window.devicePixelRatio || 1;
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
    const PADT = 28;
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

    // Overlay loudness readouts on top of history graph.
    ctx.font = '10px ' + th.fonts.mono;
    ctx.textAlign = 'left';
    ctx.fillStyle = th.history.labelText;
    const f = AM.ui && AM.ui.fmtL ? AM.ui.fmtL : (v) => (isFinite(v) && v > -90 ? v.toFixed(1) : '—');
    const line1 = `M ${f(S.momentary)}   S ${f(S.shortTerm)}   INT ${f(S.integrated)}`;
    const dT = isFinite(S.integrated)
      ? (S.integrated - S.target >= 0 ? '+' : '') + (S.integrated - S.target).toFixed(1)
      : '—';
    const line2 = `LRA ${S.lra > 0.1 ? S.lra.toFixed(1) : '—'}   TP ${f(S.truePeak)}   L ${f(S.truePeakL)}   R ${f(S.truePeakR)}   dT ${dT}`;
    ctx.fillText(line1, PADL + 4, 11);
    ctx.fillText(line2, PADL + 4, 22);

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

(function () {
  const AM = window.AM || (window.AM = {});
  const th = AM.theme;
  AM.renderers = AM.renderers || {};

  let phL = { v: -Infinity, t: 0 };
  let phR = { v: -Infinity, t: 0 };
  const holdMs = 2000;

  const MMIN = -60;
  const MMAX = 3;
  const MRNG = MMAX - MMIN;

  const TICKS = [
    { v: 3, lb: '+3', maj: true },
    { v: 0, lb: '0', maj: true, clip: true },
    { v: -3, lb: '-3' },
    { v: -6, lb: '-6', maj: true },
    { v: -9, lb: '-9' },
    { v: -12, lb: '-12', maj: true },
    { v: -18, lb: '-18', maj: true },
    { v: -23, lb: '-23' },
    { v: -24, lb: '-24' },
    { v: -36, lb: '-36' },
    { v: -48, lb: '-48' },
    { v: -60, lb: '-60' },
  ];

  function mFrac(v) {
    return Math.max(0, Math.min(1, (v - MMIN) / MRNG));
  }

  function resetPeakHold() {
    phL.v = phR.v = -Infinity;
    phL.t = phR.t = 0;
  }

  function drawMeters(cvs) {
    const dpr = window.devicePixelRatio || 1;
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
    const L = S.truePeakL;
    const R = S.truePeakR;
    const peakNow = Math.max(L, R, S.truePeak);

    const PL = 36;
    const PT = 6;
    const PB = 16;
    const BW = 32;
    const GAP = 10;
    const TH = H - PT - PB;
    const MX = PL + 8;
    const SX = MX + BW + GAP;

    function vY(v) {
      return PT + (1 - mFrac(v)) * TH;
    }

    ctx.fillStyle = th.canvas.bg;
    ctx.fillRect(0, 0, W, H);

    ctx.font = '8px ' + th.fonts.mono;
    ctx.textAlign = 'right';

    for (const t of TICKS) {
      const y = vY(t.v);
      ctx.strokeStyle = t.clip ? th.meters.clipLine : t.maj ? th.meters.tickLineMaj : th.meters.tickLineDim;
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(PL, y);
      ctx.lineTo(W, y);
      ctx.stroke();
      if (t.maj) {
        ctx.fillStyle = t.clip ? th.meters.clipLabel : th.meters.labelDim;
        ctx.fillText(t.lb, PL - 4, y + 3);
      }
    }

    // 0 line highlight
    ctx.strokeStyle = th.meters.zeroLine;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(PL, vY(0));
    ctx.lineTo(W, vY(0));
    ctx.stroke();

    function drawBar(bx, val) {
      ctx.fillStyle = th.canvas.panel;
      ctx.fillRect(bx, PT, BW, TH);
      if (!isFinite(val)) return;

      const fr = mFrac(val);
      const bH = fr * TH;
      const bY = PT + TH - bH;

      const g = ctx.createLinearGradient(bx, bY, bx, PT + TH);
      if (val >= -6) {
        g.addColorStop(0, th.meters.clipFillTop);
        g.addColorStop(0.35, th.meters.clipFillMid);
        g.addColorStop(1, th.meters.okFill);
      } else if (val >= -18) {
        g.addColorStop(0, th.meters.warnFill);
        g.addColorStop(1, th.meters.okFill);
      } else {
        g.addColorStop(0, th.meters.okFill);
        g.addColorStop(1, th.meters.badFill);
      }
      ctx.fillStyle = g;
      ctx.fillRect(bx, bY, BW, bH);

      const ec = val >= -6 ? th.meters.barOutlineBad : val >= -18 ? th.meters.barOutlineWarn : th.meters.barOutlineOk;
      ctx.fillStyle = ec;
      ctx.fillRect(bx, bY, BW, 1.5);
    }

    const now = Date.now();
    if (isFinite(L) && L > phL.v) {
      phL.v = L;
      phL.t = now + holdMs;
    }
    if (now > phL.t) phL.v = -Infinity;
    if (isFinite(R) && R > phR.v) {
      phR.v = R;
      phR.t = now + holdMs;
    }
    if (now > phR.t) phR.v = -Infinity;

    drawBar(MX, L);
    drawBar(SX, R);

    function phLine(bx, phv) {
      if (!isFinite(phv)) return;
      const y = vY(phv);
      const c = phv >= -6 ? th.meters.peakLineBad : phv >= -18 ? th.meters.peakLineWarn : th.meters.peakLineOk;
      ctx.strokeStyle = c;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(bx, y);
      ctx.lineTo(bx + BW, y);
      ctx.stroke();
    }

    phLine(MX, phL.v);
    phLine(SX, phR.v);

    function fmtV(v) {
      return isFinite(v) && v > -90 ? v.toFixed(1) : '—';
    }

    ctx.font = '8px ' + th.fonts.mono;
    ctx.textAlign = 'center';
    ctx.fillStyle = th.meters.tickText;
    ctx.fillText('L', MX + BW / 2, H - 8);
    ctx.fillText('R', SX + BW / 2, H - 8);

    ctx.fillStyle = isFinite(L) ? th.meters.smallText : th.meters.smallDimText;
    ctx.fillText(fmtV(L), MX + BW / 2, H - 1);
    ctx.fillStyle = isFinite(R) ? th.meters.smallText : th.meters.smallDimText;
    ctx.fillText(fmtV(R), SX + BW / 2, H - 1);

    ctx.textAlign = 'left';
    ctx.fillStyle = isFinite(peakNow) ? th.meters.smallText : th.meters.smallDimText;
    ctx.fillText('TP ' + fmtV(peakNow), PL, PT + 9);

    ctx.restore();
  }

  AM.renderers.meters = {
    drawMeters,
    resetPeakHold,
  };
})();

