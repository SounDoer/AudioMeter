(function () {
  const AM = window.AM || (window.AM = {});
  const th = AM.theme;
  AM.renderers = AM.renderers || {};

  let phL = { v: -Infinity, t: 0 };
  let phR = { v: -Infinity, t: 0 };
  let tpMax = -Infinity;
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

  let spBufL = new Float32Array(0);
  let spBufR = new Float32Array(0);

  function mFrac(v) {
    return Math.max(0, Math.min(1, (v - MMIN) / MRNG));
  }

  function samplePeakDb(buf) {
    let mx = 0;
    for (let i = 0; i < buf.length; i++) {
      const a = Math.abs(buf[i]);
      if (a > mx) mx = a;
    }
    return mx > 0 ? 20 * Math.log10(mx) : -Infinity;
  }

  function resetPeakHold() {
    phL.v = phR.v = -Infinity;
    phL.t = phR.t = 0;
    tpMax = -Infinity;
    AM.state.S.truePeakMax = -Infinity;
    AM.state.S.samplePeak = -Infinity;
    AM.state.S.samplePeakL = -Infinity;
    AM.state.S.samplePeakR = -Infinity;
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
    const SS = AM.state.getDisplayState ? AM.state.getDisplayState() : S;
    const anL = AM.runtime && AM.runtime.vAnL;
    const anR = AM.runtime && AM.runtime.vAnR;

    let spL = -Infinity;
    let spR = -Infinity;
    if (anL && anR) {
      const nL = anL.fftSize;
      const nR = anR.fftSize;
      if (spBufL.length !== nL) spBufL = new Float32Array(nL);
      if (spBufR.length !== nR) spBufR = new Float32Array(nR);
      anL.getFloatTimeDomainData(spBufL);
      anR.getFloatTimeDomainData(spBufR);
      spL = samplePeakDb(spBufL);
      spR = samplePeakDb(spBufR);
    }

    const samplePeakNow = Math.max(spL, spR);
    S.samplePeak = samplePeakNow;
    S.samplePeakL = spL;
    S.samplePeakR = spR;
    const truePeakNow = Math.max(S.truePeak, S.truePeakL, S.truePeakR);
    if (isFinite(truePeakNow) && truePeakNow > tpMax) tpMax = truePeakNow;
    if (isFinite(truePeakNow) && truePeakNow > S.truePeakMax) S.truePeakMax = truePeakNow;
    tpMax = S.truePeakMax;

    const PL = 36;
    const PT = 6;
    const PB = 16;
    const BW = 32;
    const GAP = 10;
    const TH = H - PT - PB;
    const barsBlockW = BW + GAP + BW;
    const mxOffset = Math.max(8, (W - PL - barsBlockW) / 2);
    const MX = PL + mxOffset;
    const SX = MX + BW + GAP;

    function vY(v) {
      return PT + (1 - mFrac(v)) * TH;
    }

    function fmtV(v) {
      return isFinite(v) && v > -90 ? v.toFixed(1) : '—';
    }

    ctx.fillStyle = th.canvas.bg;
    ctx.fillRect(0, 0, W, H);

    ctx.font = '8px ' + th.fonts.mono;
    ctx.textAlign = 'right';
    for (const t of TICKS) {
      const y = vY(t.v);
      if (t.clip) {
        // 0 dB clip / zero lines are drawn after bars so they are not covered by the bar panel fill.
      } else {
        ctx.strokeStyle = t.maj ? th.meters.tickLineMaj : th.meters.tickLineDim;
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(PL, y);
        ctx.lineTo(W, y);
        ctx.stroke();
      }
      if (t.maj) {
        ctx.fillStyle = t.clip ? th.meters.clipLabel : th.meters.labelDim;
        ctx.fillText(t.lb, PL - 4, y + 3);
      }
    }

    function drawBar(bx, val) {
      ctx.fillStyle = th.canvas.panel;
      ctx.fillRect(bx, PT, BW, TH);
      if (!isFinite(val)) return;

      const clippedVal = Math.max(MMIN, Math.min(MMAX, val));
      const zones = [
        { lo: MMIN, hi: -18, color: th.meters.badFill },
        { lo: -18, hi: -6, color: th.meters.warnFill },
        { lo: -6, hi: MMAX, color: th.meters.clipFillTop },
      ];

      for (const z of zones) {
        const segTop = Math.min(clippedVal, z.hi);
        if (segTop <= z.lo) continue;
        const yTop = vY(segTop);
        const yBottom = vY(z.lo);
        ctx.fillStyle = z.color;
        ctx.fillRect(bx, yTop, BW, Math.max(1, yBottom - yTop));
      }

      const ec = val >= -6 ? th.meters.barOutlineBad : val >= -18 ? th.meters.barOutlineWarn : th.meters.barOutlineOk;
      ctx.fillStyle = ec;
      ctx.fillRect(bx, vY(clippedVal), BW, 1.5);
    }

    const now = Date.now();
    if (isFinite(spL) && spL > phL.v) {
      phL.v = spL;
      phL.t = now + holdMs;
    }
    if (now > phL.t) phL.v = -Infinity;
    if (isFinite(spR) && spR > phR.v) {
      phR.v = spR;
      phR.t = now + holdMs;
    }
    if (now > phR.t) phR.v = -Infinity;

    const shownSpL = isFinite(SS.samplePeakL) ? SS.samplePeakL : spL;
    const shownSpR = isFinite(SS.samplePeakR) ? SS.samplePeakR : spR;

    drawBar(MX, shownSpL);
    drawBar(SX, shownSpR);

    const y0 = vY(0);
    ctx.strokeStyle = th.meters.clipLine;
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(MX, y0);
    ctx.lineTo(MX + BW, y0);
    ctx.moveTo(SX, y0);
    ctx.lineTo(SX + BW, y0);
    ctx.stroke();
    ctx.strokeStyle = th.meters.zeroLine;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(MX, y0);
    ctx.lineTo(MX + BW, y0);
    ctx.moveTo(SX, y0);
    ctx.lineTo(SX + BW, y0);
    ctx.stroke();

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

    const shownTpMax = isFinite(SS.truePeakMax) ? SS.truePeakMax : tpMax;
    if (isFinite(shownTpMax)) {
      const y = vY(shownTpMax);
      ctx.strokeStyle = th.meters.peakLineWarn;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(MX, y);
      ctx.lineTo(MX + BW, y);
      ctx.moveTo(SX, y);
      ctx.lineTo(SX + BW, y);
      ctx.stroke();
    }

    ctx.font = '8px ' + th.fonts.mono;
    ctx.textAlign = 'center';
    ctx.fillStyle = th.meters.tickText;
    ctx.fillText('L', MX + BW / 2, H - 8);
    ctx.fillText('R', SX + BW / 2, H - 8);

    ctx.fillStyle = isFinite(shownSpL) ? th.meters.smallText : th.meters.smallDimText;
    ctx.fillText(fmtV(shownSpL), MX + BW / 2, H - 1);
    ctx.fillStyle = isFinite(shownSpR) ? th.meters.smallText : th.meters.smallDimText;
    ctx.fillText(fmtV(shownSpR), SX + BW / 2, H - 1);

    ctx.textAlign = 'left';
    const shownSamplePeak = SS.samplePeak;
    ctx.fillStyle = isFinite(shownSamplePeak) ? th.meters.smallText : th.meters.smallDimText;
    ctx.fillText('SP ' + fmtV(shownSamplePeak), PL, PT + 9);
    ctx.fillStyle = isFinite(shownTpMax) ? th.meters.smallText : th.meters.smallDimText;
    ctx.fillText('TP MAX ' + fmtV(shownTpMax), PL + 46, PT + 9);

    ctx.restore();
  }

  AM.renderers.meters = {
    drawMeters,
    resetPeakHold,
  };
})();
