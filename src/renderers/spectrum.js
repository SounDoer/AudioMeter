(function () {
  const AM = window.AM || (window.AM = {});
  const th = AM.theme;
  AM.renderers = AM.renderers || {};

  let spkData = null;
  let spkAge = null;
  let spkW = 0;
  let curveDb = null;
  let curveMask = null;
  let liveFdt = null;
  let lastSnapHistHead = -1;
  const SNAP_POINTS = 192;
  const DBMIN = -100;
  const DBMAX = 0;
  const FREQ_LABELS = [
    [20, '20'],
    [50, '50'],
    [100, '100'],
    [200, '200'],
    [500, '500'],
    [1000, '1k'],
    [2000, '2k'],
    [5000, '5k'],
    [10000, '10k'],
    [20000, '20k'],
  ];

  function drawSpectrum(cvs, analyser) {
    const dpr = window.devicePixelRatio || 1;
    const W = cvs.offsetWidth;
    const H = cvs.offsetHeight;
    if (!W || !H) return;

    if (cvs.width !== Math.round(W * dpr) || cvs.height !== Math.round(H * dpr)) {
      cvs.width = Math.round(W * dpr);
      cvs.height = Math.round(H * dpr);
      spkData = null;
    }

    const ctx = cvs.getContext('2d');
    ctx.save();
    ctx.scale(dpr, dpr);

    const PADL = 42;
    const PADR = 6;
    const PADT = 6;
    const PADB = 18;
    const CW = W - PADL - PADR;
    const CH = H - PADT - PADB;

    const visualSnap = AM.state.getDisplayVisualSnapshot ? AM.state.getDisplayVisualSnapshot() : null;
    const frozenCurve = visualSnap && visualSnap.spectrumCurve;
    const SR = analyser.context.sampleRate;
    const BL = analyser.frequencyBinCount;
    const fdt = frozenCurve
      ? null
      : (liveFdt && liveFdt.length === BL ? liveFdt : (liveFdt = new Float32Array(BL)));
    if (fdt) analyser.getFloatFrequencyData(fdt);

    const LOG20 = Math.log10(20);
    const LOG20K = Math.log10(20000);
    function fToX(f) {
      return PADL + ((Math.log10(Math.max(20, f)) - LOG20) / (LOG20K - LOG20)) * CW;
    }
    function dToY(d) {
      return PADT + (1 - (d - DBMIN) / (DBMAX - DBMIN)) * CH;
    }
    function fToBin(f) {
      return Math.round((f / (SR / 2)) * BL);
    }

    if (!spkData || spkW !== CW) {
      spkData = new Float32Array(CW).fill(DBMIN);
      spkAge = new Float32Array(CW).fill(0);
      curveDb = new Float32Array(CW).fill(DBMIN);
      curveMask = new Uint8Array(CW).fill(0);
      spkW = CW;
    }

    ctx.fillStyle = th.canvas.bg;
    ctx.fillRect(0, 0, W, H);

    const fGrid = [20, 30, 40, 50, 70, 100, 150, 200, 300, 500, 700, 1000, 1500, 2000, 3000, 5000, 7000, 10000, 15000, 20000];

    for (const f of fGrid) {
      const x = fToX(f);
      if (x < PADL || x > PADL + CW) continue;
      const isMajor = f === 20 || f === 50 || f === 100 || f === 200 || f === 500 || f === 1000 || f === 2000 || f === 5000 || f === 10000 || f === 20000;
      ctx.strokeStyle = isMajor ? th.spectrum.gridMaj : th.spectrum.gridDim;
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(x, PADT);
      ctx.lineTo(x, PADT + CH);
      ctx.stroke();
    }
    for (const d of [-100, -84, -72, -60, -48, -36, -24, -12, -6, 0]) {
      const y = dToY(d);
      if (y < PADT || y > PADT + CH) continue;
      ctx.strokeStyle = d === 0 ? th.spectrum.zeroLine : th.spectrum.gridMaj;
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(PADL, y);
      ctx.lineTo(PADL + CW, y);
      ctx.stroke();
    }

    curveMask.fill(0);
    let validCount = 0;
    for (let px = 0; px < CW; px++) {
      const frac = px / CW;
      const freq = Math.pow(10, LOG20 + frac * (LOG20K - LOG20));
      const bin = fToBin(freq);
      let maxDb = DBMIN;
      if (frozenCurve && frozenCurve.length > 0) {
        const idx = Math.round(frac * (frozenCurve.length - 1));
        maxDb = frozenCurve[idx];
      } else {
        if (bin <= 0 || bin >= BL) continue;
        const span = Math.max(1, Math.round(bin * 0.015));
        for (let b = Math.max(1, bin - span); b <= Math.min(BL - 1, bin + span); b++) {
          if (fdt[b] > maxDb) maxDb = fdt[b];
        }
      }
      maxDb = Math.max(DBMIN, Math.min(DBMAX, maxDb));
      curveDb[px] = maxDb;
      curveMask[px] = 1;
      validCount++;

      if (frozenCurve) {
        spkData[px] = maxDb;
        spkAge[px] = 0;
      } else if (maxDb > spkData[px]) {
        spkData[px] = maxDb;
        spkAge[px] = 0;
      } else if (++spkAge[px] > 120) {
        spkData[px] = Math.max(DBMIN, spkData[px] - 0.3);
      }
    }

    if (validCount > 1) {
      // filled area
      let start = 0;
      while (start < CW && !curveMask[start]) start++;
      let end = CW - 1;
      while (end >= 0 && !curveMask[end]) end--;
      if (start > end) {
        ctx.restore();
        return;
      }
      ctx.beginPath();
      ctx.moveTo(PADL + start, PADT + CH);
      for (let px = start; px <= end; px++) {
        if (!curveMask[px]) continue;
        ctx.lineTo(PADL + px, dToY(curveDb[px]));
      }
      ctx.lineTo(PADL + end, PADT + CH);
      ctx.closePath();

      const gf = ctx.createLinearGradient(0, PADT, 0, PADT + CH);
      gf.addColorStop(0, th.spectrum.fillGrad1);
      gf.addColorStop(0.18, th.spectrum.fillGrad2);
      gf.addColorStop(0.5, th.spectrum.fillGrad3);
      gf.addColorStop(1, th.spectrum.fillGrad4);
      ctx.fillStyle = gf;
      ctx.fill();

      // outline + trail
      ctx.beginPath();
      ctx.moveTo(PADL + start, dToY(curveDb[start]));
      for (let px = start; px <= end; px++) {
        if (!curveMask[px]) continue;
        ctx.lineTo(PADL + px, dToY(curveDb[px]));
      }
      ctx.strokeStyle = th.spectrum.stroke;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.beginPath();
      let first = true;
      for (let px = 0; px < CW; px++) {
        const y = dToY(spkData[px]);
        if (first) {
          ctx.moveTo(PADL + px, y);
          first = false;
        } else {
          ctx.lineTo(PADL + px, y);
        }
      }
      ctx.strokeStyle = th.spectrum.strokeAge;
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    if (!frozenCurve && AM.state.histCount > 0) {
      const curHead = AM.state.histHead;
      if (curHead !== lastSnapHistHead) {
        lastSnapHistHead = curHead;
        const snap = new Float32Array(SNAP_POINTS);
        for (let i = 0; i < SNAP_POINTS; i++) {
          const px = Math.round((i / Math.max(1, SNAP_POINTS - 1)) * Math.max(0, CW - 1));
          snap[i] = spkData[px];
        }
        if (AM.state.setSpectrumSnapshotForLatest) AM.state.setSpectrumSnapshotForLatest(snap);
      }
    }

    ctx.strokeStyle = th.spectrum.border;
    ctx.lineWidth = 1;
    ctx.strokeRect(PADL, PADT, CW, CH);

    ctx.font = '9px ' + th.fonts.condensed;
    ctx.fillStyle = th.spectrum.labelText;
    ctx.textAlign = 'center';
    for (const [f, lbl] of FREQ_LABELS) {
      const x = fToX(f);
      if (x >= PADL && x <= PADL + CW) ctx.fillText(lbl, x, H - 4);
    }

    ctx.textAlign = 'right';
    for (const d of [-84, -72, -60, -48, -36, -24, -12, -6, 0]) {
      const y = dToY(d);
      if (y >= PADT && y <= PADT + CH) {
        ctx.fillStyle = d === 0 ? th.spectrum.zeroLabel : th.spectrum.labelText;
        ctx.fillText(d.toString(), PADL - 4, y + 3);
      }
    }

    ctx.restore();
  }

  AM.renderers.spectrum = {
    drawSpectrum,
  };
})();

