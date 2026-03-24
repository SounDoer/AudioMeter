(function () {
  const AM = window.AM || (window.AM = {});

  const STORE_KEY = 'am.layout.v3';
  const SPLIT_PX = 6;
  const MAIN_MIN = {
    left: 180,
    right: 620,
  };
  const MODULE_DEFAULTS = {
    peakMod: { ratio: 0.68, min: 140 },
    leftVecMod: { ratio: 0.32, min: 100 },
    loudMod: { ratio: 0.54, min: 180 },
    specMod: { ratio: 0.46, min: 190 },
  };
  const FALLBACK_RATIO = 0.2;
  const FALLBACK_MIN = 96;
  const DEF_LEFT_RATIO = 0.22;

  let state = {
    leftRatio: DEF_LEFT_RATIO,
    modRatios: {},
  };
  let leftModel = null;
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

  function initVerticalModel(containerId) {
    const el = document.getElementById(containerId);
    if (!el) return null;

    const mods = Array.from(el.children).filter((c) => c.classList && c.classList.contains('mod'));
    const splits = Array.from(el.children).filter((c) => c.classList && c.classList.contains('splitV'));
    if (mods.length < 1 || splits.length !== mods.length - 1) return null;

    const items = mods.map((modEl, idx) => getModuleConfig(modEl, idx, mods.length));
    normalizeRatios(items);

    return {
      root: el,
      mods,
      splits,
      items,
      px: new Array(items.length).fill(0),
    };
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

  function getVerticalInnerHeight(model) {
    const root = model.root;
    const cs = getComputedStyle(root);
    const padTop = Number.parseFloat(cs.paddingTop) || 0;
    const padBottom = Number.parseFloat(cs.paddingBottom) || 0;
    const rowGap = Number.parseFloat(cs.rowGap) || 0;
    const rowCount = model.items.length + model.splits.length;
    return root.clientHeight - padTop - padBottom - rowGap * Math.max(0, rowCount - 1);
  }

  function applyVerticalLayout(model) {
    if (!model) return;
    const { root, items } = model;

    const splitCount = items.length - 1;
    const innerH = getVerticalInnerHeight(model) - splitCount * SPLIT_PX;
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
    root.style.gridTemplateRows = rows.join(' ');

    model.px = px;
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
    applyVerticalLayout(leftModel);
    applyVerticalLayout(rightModel);
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

  function startDragSplitByIndex(model, splitIdx, e) {
    if (!model) return;
    const { root, items, px } = model;
    if (splitIdx < 0 || splitIdx >= items.length - 1) return;

    const startY = e.clientY;
    const startA = px[splitIdx];
    const startB = px[splitIdx + 1];
    const minA = items[splitIdx].min;
    const minB = items[splitIdx + 1].min;
    const innerH = getVerticalInnerHeight(model) - (items.length - 1) * SPLIT_PX;

    function onMove(ev) {
      const dy = ev.clientY - startY;
      const c = clampTwoWithRest(startA + startB, startA + dy, startB - dy, minA, minB);
      model.px[splitIdx] = c.a;
      model.px[splitIdx + 1] = c.b;

      const rows = [];
      for (let i = 0; i < model.px.length; i++) {
        rows.push(model.px[i] + 'px');
        if (i < model.px.length - 1) rows.push(SPLIT_PX + 'px');
      }
      root.style.gridTemplateRows = rows.join(' ');

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
    [leftModel, rightModel].forEach((model) => {
      if (!model) return;
      model.items.forEach((it) => {
        const preset = MODULE_DEFAULTS[it.id];
        it.ratio = Number((preset && preset.ratio) || (1 / Math.max(1, model.items.length)) || FALLBACK_RATIO);
        state.modRatios[it.id] = it.ratio;
      });
      normalizeRatios(model.items);
    });
    applyLayout();
    saveState();
    refreshStaticRender();
  }

  function init() {
    loadState();
    leftModel = initVerticalModel('lp');
    rightModel = initVerticalModel('rp');
    applyLayout();
    refreshStaticRender();

    const splitMain = document.getElementById('splitMain');
    const resetLayoutBtn = document.getElementById('resetLayoutBtn');

    if (splitMain) splitMain.addEventListener('pointerdown', startDragMain);
    [leftModel, rightModel].forEach((model) => {
      if (!model) return;
      model.splits.forEach((sp, idx) => {
        sp.addEventListener('pointerdown', (e) => startDragSplitByIndex(model, idx, e));
      });
    });
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
