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
    const peakMax = Math.max(L, R, S.truePeak);

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
    ctx.fillStyle = isFinite(peakMax) ? th.meters.smallText : th.meters.smallDimText;
    ctx.fillText('MAX ' + fmtV(peakMax), PL, PT + 9);

    ctx.restore();
  }

  AM.renderers.meters = {
    drawMeters,
    resetPeakHold,
  };
})();

