(function () {
  const AM = window.AM || (window.AM = {});
  const th = AM.theme;
  AM.renderers = AM.renderers || {};
  let liveLeft = null;
  let liveRight = null;
  let lastTraceHistHead = -1;
  const TRACE_STEP = 12;
  const LIVE_TARGET_POINTS = 320;
  const FROZEN_TARGET_POINTS = 320;
  const PAD = 8;

  /** @returns {{ CW: number, CH: number, cx: number, cy: number, scale: number }} */
  function vecLayout(W, H) {
    const CW = W - PAD * 2;
    const CH = H - PAD * 2;
    const cx = PAD + CW / 2;
    const cy = PAD + CH / 2;
    const scale = Math.min(CW, CH) * 0.82;
    return { CW, CH, cx, cy, scale };
  }

  /** Background, border, axes, diagonals (exactly corner-to-corner of the frame). */
  function drawVecFrame(ctx, W, H) {
    const { CW, CH, cx, cy } = vecLayout(W, H);

    ctx.fillStyle = th.vectorscope.bg;
    ctx.fillRect(0, 0, W, H);

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

    ctx.beginPath();
    ctx.moveTo(PAD, PAD);
    ctx.lineTo(PAD + CW, PAD + CH);
    ctx.moveTo(PAD + CW, PAD);
    ctx.lineTo(PAD, PAD + CH);
    ctx.strokeStyle = th.vectorscope.grid;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  /** L / R (top) and CORRELATION + value (bottom-right), inside the frame. */
  function drawVecLabels(ctx, CW, CH, shownCorr, corrIsNumeric) {
    ctx.globalCompositeOperation = 'source-over';
    ctx.textBaseline = 'alphabetic';

    ctx.fillStyle = th.vectorscope.text;
    ctx.font = 'bold 10px ' + th.fonts.mono;
    ctx.textAlign = 'left';
    ctx.fillText('L', PAD + 4, PAD + 11);
    ctx.textAlign = 'right';
    ctx.fillText('R', PAD + CW - 4, PAD + 11);

    const prefix = 'CORRELATION ';
    const numStr = corrIsNumeric ? shownCorr.toFixed(2) : '—';
    const numColor = corrIsNumeric
      ? shownCorr < -0.2
        ? th.vectorscope.corrBad
        : shownCorr < 0.2
          ? th.vectorscope.corrWarn
          : th.vectorscope.corrGood
      : th.vectorscope.text;

    ctx.font = '8px ' + th.fonts.mono;
    const y = PAD + CH - 4;
    const rightX = PAD + CW - 4;
    const wNum = ctx.measureText(numStr).width;
    const wPre = ctx.measureText(prefix).width;
    const total = wPre + wNum;
    const x0 = rightX - total;

    ctx.textAlign = 'left';
    ctx.fillStyle = th.vectorscope.text;
    ctx.fillText(prefix, x0, y);
    ctx.fillStyle = numColor;
    ctx.fillText(numStr, x0 + wPre, y);
  }

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

    const { CW, CH, cx, cy, scale } = vecLayout(W, H);

    drawVecFrame(ctx, W, H);

    const visualSnap = AM.state.getDisplayVisualSnapshot ? AM.state.getDisplayVisualSnapshot() : null;
    const frozenTrace = visualSnap && visualSnap.vectorscopeTrace;
    const N = Math.min(anL.frequencyBinCount, anR.frequencyBinCount);
    const left = frozenTrace ? null : (liveLeft && liveLeft.length === N ? liveLeft : (liveLeft = new Float32Array(N)));
    const right = frozenTrace ? null : (liveRight && liveRight.length === N ? liveRight : (liveRight = new Float32Array(N)));
    if (left && right) {
      anL.getFloatTimeDomainData(left);
      anR.getFloatTimeDomainData(right);
    }

    // Vectorscope in M/S view:
    // X = (R - L) / sqrt(2)，「左声道大」在画面左侧
    // Y = Mid = (L + R) / sqrt(2)
    const isLightMode = th.uiMode === 'light';
    ctx.globalCompositeOperation = isLightMode ? 'source-over' : 'lighter';
    ctx.strokeStyle = th.vectorscope.trace;
    ctx.lineWidth = isLightMode ? 1.2 : 1;
    ctx.beginPath();
    let started = false;
    let sumLR = 0;
    let sumL2 = 0;
    let sumR2 = 0;
    const INV_SQRT2 = 0.7071067811865476;
    if (frozenTrace && frozenTrace.length > 1) {
      const frozenPointCount = Math.floor(frozenTrace.length / 2);
      const frozenStride = Math.max(1, Math.floor(frozenPointCount / FROZEN_TARGET_POINTS));
      for (let i = 0; i + 1 < frozenTrace.length; i += 2 * frozenStride) {
        const side = frozenTrace[i];
        const mid = frozenTrace[i + 1];
        const x = cx + side * scale;
        const y = cy - mid * scale;
        if (!started) {
          ctx.moveTo(x, y);
          started = true;
        } else {
          ctx.lineTo(x, y);
        }
      }
    } else {
      const baseStep = 2;
      const dynamicStep = Math.max(baseStep, Math.floor(N / LIVE_TARGET_POINTS));
      for (let i = 0; i < N; i += dynamicStep) {
        const l = Math.max(-1, Math.min(1, left[i]));
        const r = Math.max(-1, Math.min(1, right[i]));
        const side = (r - l) * INV_SQRT2;
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
    }
    ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';

    ctx.fillStyle = th.vectorscope.center;
    ctx.fillRect(cx - 1.5, cy - 1.5, 3, 3);

    const den = Math.sqrt(sumL2 * sumR2);
    const corr = den > 1e-9 ? Math.max(-1, Math.min(1, sumLR / den)) : 0;
    if (!frozenTrace) {
      AM.state.S.correlation = corr;
      if (AM.state.histCount > 0) {
        const curHead = AM.state.histHead;
        if (curHead !== lastTraceHistHead) {
          lastTraceHistHead = curHead;
          const pointCount = Math.floor((N - 1) / TRACE_STEP) + 1;
          const trace = new Float32Array(pointCount * 2);
          let p = 0;
          for (let i = 0; i < N; i += TRACE_STEP) {
            const l = Math.max(-1, Math.min(1, left[i]));
            const r = Math.max(-1, Math.min(1, right[i]));
            trace[p++] = (r - l) * INV_SQRT2;
            trace[p++] = (l + r) * INV_SQRT2;
          }
          if (AM.state.setVectorscopeSnapshotForLatest) AM.state.setVectorscopeSnapshotForLatest(trace, corr);
        }
      }
    }
    const shownCorr = frozenTrace
      ? (visualSnap && isFinite(visualSnap.correlation) ? visualSnap.correlation : corr)
      : corr;
    const corrNumeric = frozenTrace
      ? visualSnap && isFinite(visualSnap.correlation)
      : true;
    drawVecLabels(ctx, CW, CH, shownCorr, corrNumeric);

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
    const { CW, CH } = vecLayout(W, H);
    drawVecFrame(ctx, W, H);
    drawVecLabels(ctx, CW, CH, 0, false);
    ctx.restore();
  }

  AM.renderers.vectorscope = {
    drawVectorscope,
    clearVectorscope,
  };
})();
