(function () {
  const AM = window.AM || (window.AM = {});

  const STORE_KEY = 'am.layout.v1';
  const SPLIT_PX = 6;
  const MAIN_MIN = {
    left: 260,
    right: 420,
  };
  const MODULE_DEFAULTS = {
    specMod: { ratio: 0.56, min: 180 },
    histMod: { ratio: 0.22, min: 110 },
    vecMod: { ratio: 0.22, min: 120 },
  };
  const FALLBACK_RATIO = 0.2;
  const FALLBACK_MIN = 96;
  const DEF_LEFT_RATIO = 0.34;

  let state = {
    leftRatio: DEF_LEFT_RATIO,
    modRatios: {},
  };
  let rightModel = null;
  let rafResize = 0;

  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }

  function saveState() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(state));
    } catch (_) {
      // Ignore storage errors in private mode or restricted environments.
    }
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return;
      const next = JSON.parse(raw);
      if (!next || typeof next !== 'object') return;
      state.leftRatio = clamp(Number(next.leftRatio) || DEF_LEFT_RATIO, 0.2, 0.8);
      if (next.modRatios && typeof next.modRatios === 'object') {
        state.modRatios = { ...next.modRatios };
      }
    } catch (_) {
      // Ignore malformed or inaccessible storage.
    }
  }

  function getModuleConfig(modEl, idx, count) {
    const id = modEl.id || 'mod_' + idx;
    const preset = MODULE_DEFAULTS[id] || {};
    return {
      id,
      min: Math.round(preset.min || FALLBACK_MIN),
      ratio: Number(state.modRatios[id] || preset.ratio || (1 / Math.max(1, count)) || FALLBACK_RATIO),
    };
  }

  function normalizeRatios(items) {
    let sum = 0;
    for (const item of items) sum += Math.max(0.01, item.ratio);
    if (sum <= 0) {
      const even = 1 / Math.max(1, items.length);
      for (const item of items) item.ratio = even;
      return;
    }
    for (const item of items) item.ratio = Math.max(0.01, item.ratio) / sum;
  }

  function initRightModel() {
    const rp = document.getElementById('rp');
    if (!rp) return null;

    const mods = Array.from(rp.querySelectorAll('.mod'));
    const splits = Array.from(rp.querySelectorAll('.splitV'));
    if (mods.length < 1 || splits.length !== mods.length - 1) return null;

    const items = mods.map((modEl, idx) => getModuleConfig(modEl, idx, mods.length));
    normalizeRatios(items);

    rightModel = {
      rp,
      mods,
      splits,
      items,
      px: new Array(items.length).fill(0),
    };
    return rightModel;
  }

  function clampTwoWithRest(total, a, b, minA, minB) {
    let na = a;
    let nb = b;
    if (na < minA) {
      nb -= (minA - na);
      na = minA;
    }
    if (nb < minB) {
      na -= (minB - nb);
      nb = minB;
    }
    if (na < minA) na = minA;
    if (nb < minB) nb = minB;
    const fix = total - na - nb;
    if (fix !== 0) {
      if (na - minA >= nb - minB) na += fix;
      else nb += fix;
    }
    return { a: na, b: nb };
  }

  function applyRightLayout() {
    if (!rightModel) return;
    const { rp, items } = rightModel;

    const totalH = rp.clientHeight;
    const splitCount = items.length - 1;
    const innerH = totalH - splitCount * SPLIT_PX;
    if (innerH <= 0) return;

    let minSum = 0;
    for (const it of items) minSum += it.min;
    if (innerH < minSum) return;

    normalizeRatios(items);
    const px = [];
    let used = 0;
    for (let i = 0; i < items.length; i++) {
      if (i === items.length - 1) {
        px.push(innerH - used);
      } else {
        const v = Math.max(items[i].min, Math.round(innerH * items[i].ratio));
        px.push(v);
        used += v;
      }
    }

    // Fix rounding/min constraints from bottom-up.
    for (let i = items.length - 1; i >= 0; i--) {
      if (px[i] < items[i].min) {
        const need = items[i].min - px[i];
        px[i] = items[i].min;
        for (let j = 0; j < i; j++) {
          const k = i - 1 - j;
          const take = Math.min(need, px[k] - items[k].min);
          if (take > 0) {
            px[k] -= take;
            break;
          }
        }
      }
    }

    const rows = [];
    for (let i = 0; i < px.length; i++) {
      rows.push(px[i] + 'px');
      if (i < px.length - 1) rows.push(SPLIT_PX + 'px');
    }
    rp.style.gridTemplateRows = rows.join(' ');

    rightModel.px = px;
    for (let i = 0; i < items.length; i++) {
      items[i].ratio = px[i] / innerH;
      state.modRatios[items[i].id] = items[i].ratio;
    }
  }

  function applyMainLayout() {
    const main = document.getElementById('main');
    if (!main) return;
    const mainW = main.clientWidth;
    if (mainW <= MAIN_MIN.left + MAIN_MIN.right + SPLIT_PX) return;
    const leftPx = clamp(
      Math.round(mainW * state.leftRatio),
      MAIN_MIN.left,
      mainW - SPLIT_PX - MAIN_MIN.right
    );
    main.style.gridTemplateColumns = leftPx + 'px ' + SPLIT_PX + 'px minmax(' + MAIN_MIN.right + 'px, 1fr)';
    state.leftRatio = leftPx / mainW;
  }

  function applyLayout() {
    applyMainLayout();
    applyRightLayout();
  }

  function refreshStaticRender() {
    if (rafResize) cancelAnimationFrame(rafResize);
    rafResize = requestAnimationFrame(() => {
      rafResize = 0;
      if (AM.renderLoop && AM.renderLoop.initStatic) AM.renderLoop.initStatic();
    });
  }

  function startDragMain(e) {
    const main = document.getElementById('main');
    if (!main) return;
    const startX = e.clientX;
    const startW = main.clientWidth;
    const cols = getComputedStyle(main).gridTemplateColumns.split(' ');
    const startLeft = Number.parseFloat(cols[0]);
    if (!isFinite(startLeft) || startW <= 0) return;

    function onMove(ev) {
      const nextLeft = clamp(
        startLeft + (ev.clientX - startX),
        MAIN_MIN.left,
        startW - SPLIT_PX - MAIN_MIN.right
      );
      state.leftRatio = nextLeft / startW;
      applyLayout();
      refreshStaticRender();
    }
    function onUp() {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      saveState();
    }
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }

  function startDragSplitByIndex(splitIdx, e) {
    if (!rightModel) return;
    const { rp, items, px } = rightModel;
    if (splitIdx < 0 || splitIdx >= items.length - 1) return;

    const startY = e.clientY;
    const startA = px[splitIdx];
    const startB = px[splitIdx + 1];
    const minA = items[splitIdx].min;
    const minB = items[splitIdx + 1].min;
    const totalH = rp.clientHeight;
    const innerH = totalH - (items.length - 1) * SPLIT_PX;

    function onMove(ev) {
      const dy = ev.clientY - startY;
      const c = clampTwoWithRest(startA + startB, startA + dy, startB - dy, minA, minB);
      rightModel.px[splitIdx] = c.a;
      rightModel.px[splitIdx + 1] = c.b;

      const rows = [];
      for (let i = 0; i < rightModel.px.length; i++) {
        rows.push(rightModel.px[i] + 'px');
        if (i < rightModel.px.length - 1) rows.push(SPLIT_PX + 'px');
      }
      rp.style.gridTemplateRows = rows.join(' ');

      items[splitIdx].ratio = c.a / innerH;
      items[splitIdx + 1].ratio = c.b / innerH;
      state.modRatios[items[splitIdx].id] = items[splitIdx].ratio;
      state.modRatios[items[splitIdx + 1].id] = items[splitIdx + 1].ratio;
      refreshStaticRender();
    }
    function onUp() {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      saveState();
    }
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }

  function resetLayout() {
    state = {
      leftRatio: DEF_LEFT_RATIO,
      modRatios: {},
    };
    if (rightModel) {
      rightModel.items.forEach((it, idx) => {
        const preset = MODULE_DEFAULTS[it.id];
        it.ratio = Number((preset && preset.ratio) || (1 / Math.max(1, rightModel.items.length)) || FALLBACK_RATIO);
        state.modRatios[it.id] = it.ratio;
      });
      normalizeRatios(rightModel.items);
    }
    applyLayout();
    saveState();
    refreshStaticRender();
  }

  function init() {
    loadState();
    initRightModel();
    applyLayout();
    refreshStaticRender();

    const splitMain = document.getElementById('splitMain');
    const resetLayoutBtn = document.getElementById('resetLayoutBtn');

    if (splitMain) splitMain.addEventListener('pointerdown', startDragMain);
    if (rightModel) {
      rightModel.splits.forEach((sp, idx) => {
        sp.addEventListener('pointerdown', (e) => startDragSplitByIndex(idx, e));
      });
    }
    if (resetLayoutBtn) resetLayoutBtn.addEventListener('click', resetLayout);

    window.addEventListener('resize', () => {
      applyLayout();
      refreshStaticRender();
    });
  }

  AM.layout = {
    init,
    resetLayout,
    applyLayout,
  };
})();
