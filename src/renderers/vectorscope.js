(function () {
  const AM = window.AM || (window.AM = {});
  const th = AM.theme;
  AM.renderers = AM.renderers || {};

  function drawVectorscope(cvs, anL, anR) {
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

    const PAD = 8;
    const CW = W - PAD * 2;
    const CH = H - PAD * 2;
    const cx = PAD + CW / 2;
    const cy = PAD + CH / 2;
    // Increase scope footprint for better readability.
    const scale = Math.min(CW, CH) * 0.82;

    ctx.fillStyle = th.vectorscope.bg;
    ctx.fillRect(0, 0, W, H);

    // grid
    ctx.strokeStyle = th.vectorscope.grid;
    ctx.lineWidth = 1;
    ctx.strokeRect(PAD, PAD, CW, CH);
    ctx.beginPath();
    ctx.moveTo(PAD, cy);
    ctx.lineTo(PAD + CW, cy);
    ctx.moveTo(cx, PAD);
    ctx.lineTo(cx, PAD + CH);
    ctx.strokeStyle = th.vectorscope.axis;
    ctx.lineWidth = 0.7;
    ctx.stroke();

    // +/- 45-degree guideline
    ctx.strokeStyle = th.vectorscope.grid;
    ctx.beginPath();
    ctx.moveTo(cx - scale, cy + scale);
    ctx.lineTo(cx + scale, cy - scale);
    ctx.moveTo(cx - scale, cy - scale);
    ctx.lineTo(cx + scale, cy + scale);
    ctx.stroke();

    const N = Math.min(anL.frequencyBinCount, anR.frequencyBinCount);
    const left = new Float32Array(N);
    const right = new Float32Array(N);
    anL.getFloatTimeDomainData(left);
    anR.getFloatTimeDomainData(right);

    // Vectorscope in M/S view:
    // X = Side = (L - R) / sqrt(2)
    // Y = Mid  = (L + R) / sqrt(2)
    // 这样 pure mono (L=R) 会显示为竖线，更符合直觉。
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = th.vectorscope.trace;
    ctx.lineWidth = 1;
    ctx.beginPath();
    let started = false;
    let sumLR = 0;
    let sumL2 = 0;
    let sumR2 = 0;
    const INV_SQRT2 = 0.7071067811865476;
    for (let i = 0; i < N; i += 2) {
      const l = Math.max(-1, Math.min(1, left[i]));
      const r = Math.max(-1, Math.min(1, right[i]));
      const side = (l - r) * INV_SQRT2;
      const mid = (l + r) * INV_SQRT2;
      const x = cx + side * scale;
      const y = cy - mid * scale;
      if (!started) {
        ctx.moveTo(x, y);
        started = true;
      } else {
        ctx.lineTo(x, y);
      }
      sumLR += l * r;
      sumL2 += l * l;
      sumR2 += r * r;
    }
    ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';

    // center point
    ctx.fillStyle = th.vectorscope.center;
    ctx.fillRect(cx - 1.5, cy - 1.5, 3, 3);

    // correlation coefficient in [-1, 1]
    const den = Math.sqrt(sumL2 * sumR2);
    const corr = den > 1e-9 ? Math.max(-1, Math.min(1, sumLR / den)) : 0;
    const corrEl = document.getElementById('corrVal');
    if (corrEl) {
      corrEl.textContent = corr.toFixed(2);
      corrEl.style.color = corr < -0.2 ? th.vectorscope.corrBad : corr < 0.2 ? th.vectorscope.corrWarn : th.vectorscope.corrGood;
    }

    // corner labels
    ctx.font = '8px ' + th.fonts.mono;
    ctx.fillStyle = th.vectorscope.text;
    ctx.textAlign = 'left';
    ctx.fillText('S−  M+', PAD + 2, PAD + 10);
    ctx.fillText('S+  M−', PAD + 2, PAD + 20);
    ctx.textAlign = 'right';
    ctx.fillText('Corr ' + corr.toFixed(2), W - PAD - 2, PAD + 10);

    ctx.restore();
  }

  function clearVectorscope(cvs) {
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
    ctx.fillStyle = th.vectorscope.bg;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
    const corrEl = document.getElementById('corrVal');
    if (corrEl) {
      corrEl.textContent = '—';
      corrEl.style.color = th.vectorscope.text;
    }
  }

  AM.renderers.vectorscope = {
    drawVectorscope,
    clearVectorscope,
  };
})();

