(function () {
  const AM = window.AM || (window.AM = {});
  const th = AM.theme;
  AM.renderers = AM.renderers || {};
  let layoutSyncTick = 0;
  let histBgCache = {
    w: 0,
    h: 0,
    padt: 0,
    target: 0,
    skin: '',
    canvas: null,
  };

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
      layoutSyncTick++;
      if (layoutSyncTick % 12 === 0) {
        const rh = Math.round(rdEl.getBoundingClientRect().height);
        if (rh > 0) {
          const nextH = rh + 'px';
          if (hw.style.height !== nextH) hw.style.height = nextH;
        }
      }
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
    const displayState = AM.state.getDisplayState ? AM.state.getDisplayState() : S;
    const tgt = S.target;
    const histView = AM.state.getDisplayHistory
      ? AM.state.getDisplayHistory()
      : {
          histBuf: AM.state.histBuf,
          mHistBuf: AM.state.mHistBuf,
          histHead: AM.state.histHead,
          histCount: AM.state.histCount,
        };
    const histBuf = histView.histBuf;
    const mHistBuf = histView.mHistBuf;
    const histHead = histView.histHead;
    const histCount = histView.histCount;
    const showHistST = AM.state.isHistCurveVisible ? AM.state.isHistCurveVisible('st') : true;
    const showHistM = AM.state.isHistCurveVisible ? AM.state.isHistCurveVisible('m') : true;
    const showHistInt = AM.state.isHistCurveVisible ? AM.state.isHistCurveVisible('int') : true;

    const PADL = 42;
    const PADR = 6;
    const PADB = 18;
    const CW = W - PADL - PADR;
    const CH = H - PADT - PADB;

    const DBMIN = -60;
    const DBMAX = 3;
    const DBRNG = DBMAX - DBMIN;
    // 静音时 worklet 可能会输出“极小但有限”的 LUFS（滤波器残留），
    // 如果这些值在 -60 附近来回徘徊，会导致 history 折线在底部抖动。
    // 这里对接近底部的值做“吸附”，保证无信号时显示为稳定的最小直线。
    const DB_SILENCE_ADSORB = DBMIN + 0.25; // dB

    function dToY(d) {
      const dd = Math.max(DBMIN, Math.min(DBMAX, d));
      return PADT + (1 - (dd - DBMIN) / DBRNG) * CH;
    }

    const skinKey =
      th.history.bg +
      '|' +
      th.history.grid +
      '|' +
      th.history.gridTarget +
      '|' +
      th.history.gridZero +
      '|' +
      th.history.targetLine +
      '|' +
      th.history.labelText;
    if (
      !histBgCache.canvas ||
      histBgCache.w !== W ||
      histBgCache.h !== H ||
      histBgCache.padt !== PADT ||
      Math.abs(histBgCache.target - tgt) > 0.001 ||
      histBgCache.skin !== skinKey
    ) {
      const bg = document.createElement('canvas');
      bg.width = Math.max(1, Math.round(W));
      bg.height = Math.max(1, Math.round(H));
      const bctx = bg.getContext('2d');
      bctx.fillStyle = th.history.bg;
      bctx.fillRect(0, 0, W, H);

      for (const d of [-60, -48, -36, -24, -18, -12, -6, 0, 3]) {
        const y = dToY(d);
        bctx.strokeStyle = Math.abs(d - tgt) < 0.1 ? th.history.gridTarget : d === 0 ? th.history.gridZero : th.history.grid;
        bctx.lineWidth = 0.5;
        bctx.beginPath();
        bctx.moveTo(PADL, y);
        bctx.lineTo(PADL + CW, y);
        bctx.stroke();
      }

      bctx.strokeStyle = th.history.targetLine;
      bctx.lineWidth = 1;
      bctx.setLineDash([4, 3]);
      bctx.beginPath();
      bctx.moveTo(PADL, dToY(tgt));
      bctx.lineTo(PADL + CW, dToY(tgt));
      bctx.stroke();
      bctx.setLineDash([]);

      bctx.strokeStyle = th.history.grid;
      bctx.lineWidth = 1;
      bctx.strokeRect(PADL, PADT, CW, CH);

      bctx.font = '8px ' + th.fonts.mono;
      bctx.textAlign = 'right';
      for (const d of [-48, -36, -24, -18, -12, -6, 0]) {
        const y = dToY(d);
        if (y < PADT || y > PADT + CH) continue;
        bctx.fillStyle = th.history.labelText;
        bctx.fillText(d.toString(), PADL - 4, y + 3);
      }

      histBgCache = {
        w: W,
        h: H,
        padt: PADT,
        target: tgt,
        skin: skinKey,
        canvas: bg,
      };
    }
    ctx.drawImage(histBgCache.canvas, 0, 0);

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

      // 按「像素列」聚合历史样本（min/max），避免 idxStep 抽样相位随 histHead 变化导致的滚动闪烁。
      // Momentary 仍用每列聚合后的单条折线（取列内 max），避免 min–max 竖线穿过空白区形成“碎屑”观感。
      const HMAX = AM.state.HIST_MAX;
      function bufIdx(i) {
        return (histHead - n + i + HMAX) % HMAX;
      }
      function adsorb(v) {
        return !isFinite(v) || v <= DB_SILENCE_ADSORB ? DBMIN : v;
      }
      function columnMinMax(buf, iLo, iHi) {
        let vmin = Infinity;
        let vmax = -Infinity;
        for (let i = iLo; i <= iHi; i++) {
          const v = adsorb(buf[bufIdx(i)]);
          if (v < vmin) vmin = v;
          if (v > vmax) vmax = v;
        }
        if (!isFinite(vmin) || !isFinite(vmax)) {
          vmin = vmax = DBMIN;
        }
        return { vmin, vmax };
      }
      function columnRange(pxCol) {
        // 将 n 个历史点均分到 CW 列（与示波器 waveform 的 per-pixel min/max 一致）
        let iLo = Math.floor((pxCol / CW) * n);
        let iHi = Math.floor(((pxCol + 1) / CW) * n) - 1;
        if (iHi < iLo) iHi = iLo;
        iLo = Math.max(0, Math.min(n - 1, iLo));
        iHi = Math.max(0, Math.min(n - 1, iHi));
        if (iHi < iLo) iHi = iLo;
        return { iLo, iHi };
      }

      const lastIdx = (histHead - 1 + HMAX) % HMAX;

      if (showHistST) {
        const stTop = [];
        for (let pxCol = 0; pxCol < CW; pxCol++) {
          const { iLo, iHi } = columnRange(pxCol);
          stTop.push(columnMinMax(histBuf, iLo, iHi).vmax);
        }
        const stRight = adsorb(histBuf[lastIdx]);

        ctx.beginPath();
        ctx.moveTo(PADL, PADT + CH);
        for (let pxCol = 0; pxCol < CW; pxCol++) {
          ctx.lineTo(PADL + pxCol, dToY(stTop[pxCol]));
        }
        ctx.lineTo(PADL + CW, dToY(stRight));
        ctx.lineTo(PADL + CW, PADT + CH);
        ctx.closePath();

        const gf = ctx.createLinearGradient(0, PADT, 0, PADT + CH);
        gf.addColorStop(0, th.history.fillGrad1);
        gf.addColorStop(1, th.history.fillGrad2);
        ctx.fillStyle = gf;
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(PADL, dToY(stTop[0]));
        for (let pxCol = 1; pxCol < CW; pxCol++) {
          ctx.lineTo(PADL + pxCol, dToY(stTop[pxCol]));
        }
        ctx.lineTo(PADL + CW, dToY(stRight));
        ctx.strokeStyle = th.history.stroke;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      if (showHistM) {
        const mTop = [];
        for (let pxCol = 0; pxCol < CW; pxCol++) {
          const { iLo, iHi } = columnRange(pxCol);
          mTop.push(columnMinMax(mHistBuf, iLo, iHi).vmax);
        }
        const mRight = adsorb(mHistBuf[lastIdx]);
        ctx.beginPath();
        ctx.moveTo(PADL, dToY(mTop[0]));
        for (let pxCol = 1; pxCol < CW; pxCol++) {
          ctx.lineTo(PADL + pxCol, dToY(mTop[pxCol]));
        }
        ctx.lineTo(PADL + CW, dToY(mRight));
        ctx.strokeStyle = th.history.secondaryStroke;
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      if (showHistInt && isFinite(displayState.integrated)) {
        const iy = dToY(displayState.integrated);
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
        ctx.fillText('INT ' + displayState.integrated.toFixed(1), PADL + 4, iy - 3);
      }

      const selOffset = AM.state.selectedHistOffset;
      if (selOffset >= 0) {
        const sx = PADL + CW - (selOffset / Math.max(1, n - 1)) * CW;
        ctx.strokeStyle = th.history.marker;
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 3]);
        ctx.beginPath();
        ctx.moveTo(sx, PADT);
        ctx.lineTo(sx, PADT + CH);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    ctx.restore();
  }

  function bindHistoryPointer(cvs) {
    if (!cvs || cvs.dataset.histBound === '1') return;
    cvs.dataset.histBound = '1';

    let dragging = false;

    function updateSelectionFromX(clientX) {
      const rect = cvs.getBoundingClientRect();
      const PADL = 42;
      const PADR = 6;
      const x = clientX - rect.left;
      const cw = Math.max(1, rect.width - PADL - PADR);
      const local = Math.max(0, Math.min(cw, x - PADL));
      const histCount = AM.state.histCount;
      if (histCount < 1) {
        if (AM.state.clearSelectedHistory) AM.state.clearSelectedHistory();
        return;
      }
      const n = Math.min(histCount, cw * 4);
      const fromEnd = ((cw - local) / cw) * Math.max(0, n - 1);
      if (AM.state.setSelectedHistOffset) AM.state.setSelectedHistOffset(fromEnd);
    }

    function onPointerDown(ev) {
      dragging = true;
      if (cvs.setPointerCapture) {
        try {
          cvs.setPointerCapture(ev.pointerId);
        } catch (_) {}
      }
      updateSelectionFromX(ev.clientX);
    }

    function onPointerMove(ev) {
      if (!dragging) return;
      updateSelectionFromX(ev.clientX);
    }

    function onPointerUp(ev) {
      dragging = false;
      if (cvs.releasePointerCapture) {
        try {
          cvs.releasePointerCapture(ev.pointerId);
        } catch (_) {}
      }
    }

    function onDblClick() {
      if (AM.state.clearSelectedHistory) AM.state.clearSelectedHistory();
    }

    cvs.addEventListener('pointerdown', onPointerDown);
    cvs.addEventListener('pointermove', onPointerMove);
    cvs.addEventListener('pointerup', onPointerUp);
    cvs.addEventListener('pointercancel', onPointerUp);
    cvs.addEventListener('dblclick', onDblClick);
  }

  AM.renderers.history = {
    drawHistory,
    bindHistoryPointer,
  };
})();
