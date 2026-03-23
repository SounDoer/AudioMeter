const S = {
  momentary: -Infinity,
  shortTerm: -Infinity,
  integrated: -Infinity,
  lra: 0,
  truePeak: -Infinity,
  mMax: -Infinity,
  stMax: -Infinity,
  target: -23,
  running: false,
};

const HIST_MAX = 6000;
const histBuf = new Float32Array(HIST_MAX).fill(-Infinity);
let histHead = 0;
let histCount = 0;

function histPush(v) {
  histBuf[histHead] = v;
  histHead = (histHead + 1) % HIST_MAX;
  if (histCount < HIST_MAX) histCount++;
}

let actx = null;
let wklt = null;
let ansr = null;
let src = null;
let mstrm = null;
let raf = null;
const phM = { v: -Infinity, t: 0 };
const phS = { v: -Infinity, t: 0 };

function setSt(msg, cls) {
  const e = document.getElementById('stMsg');
  e.textContent = msg;
  e.className = 'st' + (cls ? ' ' + cls : '');
}

function setSt2(msg) {
  document.getElementById('stDev').textContent = msg;
}

// AudioWorklet 代码内联兜底。
// 目的：当你直接用 file:// 打开页面时，浏览器可能无法加载外部 worklet 脚本，
// 从而导致 START 无法工作。此方案使用 data: URL 可显著提高成功率。
const WKLT = `'use strict';
class BQ {
  constructor(b0, b1, b2, a1, a2) {
    this.b0 = b0;
    this.b1 = b1;
    this.b2 = b2;
    this.a1 = a1;
    this.a2 = a2;
    this.x1 = 0;
    this.x2 = 0;
    this.y1 = 0;
    this.y2 = 0;
  }
  tick(x) {
    const y =
      this.b0 * x +
      this.b1 * this.x1 +
      this.b2 * this.x2 -
      this.a1 * this.y1 -
      this.a2 * this.y2;
    this.x2 = this.x1;
    this.x1 = x;
    this.y2 = this.y1;
    this.y1 = y;
    return y;
  }
}
function kwCoeffs(sr) {
  const Vh = Math.pow(10, 3.999843853973347 / 20);
  const Vb = Math.pow(Vh, 0.4996667741545416);
  const f0 = 1681.974450955533;
  const Q1 = 0.7071752369554196;
  const K1 = Math.tan(Math.PI * f0 / sr);
  const d0 = 1 + K1 / Q1 + K1 * K1;
  const s1 = {
    b0: (Vh + Vb * K1 / Q1 + K1 * K1) / d0,
    b1: 2 * (K1 * K1 - Vh) / d0,
    b2: (Vh - Vb * K1 / Q1 + K1 * K1) / d0,
    a1: 2 * (K1 * K1 - 1) / d0,
    a2: (1 - K1 / Q1 + K1 * K1) / d0,
  };
  const f1 = 38.13547087602444;
  const Q2 = 0.5003270373238773;
  const K2 = Math.tan(Math.PI * f1 / sr);
  const d1 = 1 + K2 / Q2 + K2 * K2;
  const s2 = {
    b0: 1,
    b1: -2,
    b2: 1,
    a1: 2 * (K2 * K2 - 1) / d1,
    a2: (1 - K2 / Q2 + K2 * K2) / d1,
  };
  return { s1, s2 };
}
class LoudnessMeter extends AudioWorkletProcessor {
  constructor() {
    super();
    const sr = sampleRate;
    const c = kwCoeffs(sr);
    const mf = (s) => [
      new BQ(s.s1.b0, s.s1.b1, s.s1.b2, s.s1.a1, s.s1.a2),
      new BQ(s.s2.b0, s.s2.b1, s.s2.b2, s.s2.a1, s.s2.a2),
    ];
    this.kf = [mf(c), mf(c)];
    this.bsz = Math.round(sr * 0.1);
    this.ba = [0, 0];
    this.bn = 0;
    this.RN = 60;
    this.ring = new Float64Array(this.RN * 2);
    this.rh = 0;
    this.rc = 0;
    this.ibl = [];
    this.sth = [];
    this.tpMax = 0;
    this.tpBlock = 0;
    this._initTP();
    this.tpH = [new Float64Array(this.tpT), new Float64Array(this.tpT)];
    this.tpWP = [0, 0];
    this.port.onmessage = (e) => {
      if (e.data === 'reset') this._reset();
    };
  }
  _reset() {
    this.ibl = [];
    this.sth = [];
    this.tpMax = 0;
    this.ring.fill(0);
    this.rh = 0;
    this.rc = 0;
  }
  _initTP() {
    const P = 4;
    const T = 32;
    const N = P * T;
    const h = new Float64Array(N);
    const ctr = (N - 1) / 2;
    for (let i = 0; i < N; i++) {
      const n = i - ctr;
      const x = n / P;
      const sinc = Math.abs(x) < 1e-12 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x);
      const bh =
        0.35875 -
        0.48829 * Math.cos(2 * Math.PI * i / (N - 1)) +
        0.14128 * Math.cos(4 * Math.PI * i / (N - 1)) -
        0.01168 * Math.cos(6 * Math.PI * i / (N - 1));
      h[i] = sinc * bh;
    }
    this.tpPh = [];
    for (let p = 0; p < P; p++) {
      const ph = new Float64Array(T);
      for (let t = 0; t < T; t++) ph[t] = h[p + t * P];
      const s = ph.reduce((a, v) => a + v, 0);
      if (Math.abs(s) > 1e-10) for (let t = 0; t < T; t++) ph[t] /= s;
      this.tpPh.push(ph);
    }
    this.tpT = T;
    this.tpP = P;
  }
  _tpSample(x, ch) {
    const T = this.tpT;
    const H = this.tpH[ch];
    const wp = this.tpWP[ch];
    H[wp] = x;
    this.tpWP[ch] = (wp + 1) % T;
    let mx = Math.abs(x);
    for (let p = 1; p < this.tpP; p++) {
      const ph = this.tpPh[p];
      let y = 0;
      for (let t = 0; t < T; t++) y += ph[t] * H[(wp - t + T) % T];
      if (Math.abs(y) > mx) mx = Math.abs(y);
    }
    return mx;
  }
  _lufs(m0, m1) {
    const s = m0 + m1;
    return s <= 0 ? -Infinity : -0.691 + 10 * Math.log10(s);
  }
  _integrated() {
    const b = this.ibl;
    if (!b.length) return -Infinity;
    let s0 = 0;
    let s1 = 0;
    let n = 0;
    for (const x of b) {
      if (this._lufs(x[0], x[1]) > -70) {
        s0 += x[0];
        s1 += x[1];
        n++;
      }
    }
    if (!n) return -Infinity;
    const Ga = -0.691 + 10 * Math.log10(s0 / n + s1 / n) - 10;
    s0 = 0;
    s1 = 0;
    n = 0;
    for (const x of b) {
      const l = this._lufs(x[0], x[1]);
      if (l > -70 && l > Ga) {
        s0 += x[0];
        s1 += x[1];
        n++;
      }
    }
    if (!n) return -Infinity;
    return -0.691 + 10 * Math.log10(s0 / n + s1 / n);
  }
  _lra() {
    const h = this.sth.filter((l) => isFinite(l) && l > -70);
    if (h.length < 2) return 0;
    const mean = h.reduce((s, l) => s + Math.pow(10, l / 10), 0) / h.length;
    const Gr = 10 * Math.log10(mean) - 20;
    const r = h.filter((l) => l > Gr).sort((a, b) => a - b);
    if (r.length < 2) return 0;
    return Math.max(0, r[Math.floor(r.length * 0.95)] - r[Math.floor(r.length * 0.10)]);
  }
  process(inputs) {
    const inp = inputs[0];
    if (!inp || !inp.length) return true;
    const nc = Math.min(inp.length, 2);
    const len = inp[0].length;
    for (let i = 0; i < len; i++) {
      for (let ch = 0; ch < 2; ch++) {
        const x = ch < nc ? inp[ch][i] : (nc === 1 ? inp[0][i] : 0);
        const kw = this.kf[ch][1].tick(this.kf[ch][0].tick(x));
        this.ba[ch] += kw * kw;
        const tp = this._tpSample(x, ch);
        if (tp > this.tpBlock) this.tpBlock = tp;
      }
      if (++this.bn >= this.bsz) {
        const m0 = this.ba[0] / this.bn;
        const m1 = this.ba[1] / this.bn;
        this.ring[this.rh * 2] = m0;
        this.ring[this.rh * 2 + 1] = m1;
        this.rh = (this.rh + 1) % this.RN;
        this.rc = Math.min(this.rc + 1, this.RN);
        this.ibl.push([m0, m1]);
        if (this.ibl.length > 36000) this.ibl.shift();
        let a0 = 0;
        let a1 = 0;
        let an = 0;
        for (let b = 0; b < Math.min(4, this.rc); b++) {
          const idx = ((this.rh - 1 - b + this.RN) % this.RN) * 2;
          a0 += this.ring[idx];
          a1 += this.ring[idx + 1];
          an++;
        }
        const momentary = an ? this._lufs(a0 / an, a1 / an) : -Infinity;
        a0 = 0;
        a1 = 0;
        an = 0;
        for (let b = 0; b < Math.min(30, this.rc); b++) {
          const idx = ((this.rh - 1 - b + this.RN) % this.RN) * 2;
          a0 += this.ring[idx];
          a1 += this.ring[idx + 1];
          an++;
        }
        const shortTerm = an ? this._lufs(a0 / an, a1 / an) : -Infinity;
        if (isFinite(shortTerm)) {
          this.sth.push(shortTerm);
          if (this.sth.length > 36000) this.sth.shift();
        }
        if (this.tpBlock > this.tpMax) this.tpMax = this.tpBlock;
        this.port.postMessage({
          momentary,
          shortTerm,
          integrated: this._integrated(),
          lra: this._lra(),
          truePeak: this.tpMax > 0 ? 20 * Math.log10(this.tpMax) : -Infinity,
        });
        this.ba[0] = 0;
        this.ba[1] = 0;
        this.bn = 0;
        this.tpBlock = 0;
      }
    }
    return true;
  }
}
registerProcessor('loudness-meter', LoudnessMeter);
`;

async function loadDevices() {
  try {
    const devs = await navigator.mediaDevices.enumerateDevices();
    const ins = devs.filter((d) => d.kind === 'audioinput');
    const sel = document.getElementById('devSel');
    const cur = sel.value;
    sel.innerHTML = '';
    for (const d of ins) {
      const o = document.createElement('option');
      o.value = d.deviceId;
      o.textContent = d.label || (d.deviceId === 'default' ? 'Default input' : 'Input ' + (sel.options.length + 1));
      if (d.deviceId === cur) o.selected = true;
      sel.appendChild(o);
    }
  } catch (_) {
    // Intentionally ignored: device list may fail before permission grant.
  }
}

async function initAudio() {
  setSt('Requesting microphone...', 'warn');
  const devId = document.getElementById('devSel').value;
  mstrm = await navigator.mediaDevices.getUserMedia({
    audio: {
      deviceId: devId ? { exact: devId } : undefined,
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
    },
  });

  actx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' });
  try {
    setSt2('Loading worklet...');
    await actx.audioWorklet.addModule('./worklets/loudness-meter.js');
  } catch (errWorklet) {
    // 回退：使用 data: URL 内联 worklet，避免外部脚本在 file:// 下加载失败。
    console.warn('Worklet external load failed, fallback to inline WKLT:', errWorklet);
    try {
      setSt2('Worklet inline fallback...');
      const b64 = btoa(unescape(encodeURIComponent(WKLT)));
      await actx.audioWorklet.addModule('data:application/javascript;base64,' + b64);
    } catch (errInline) {
      throw errWorklet;
    }
  }
  wklt = new AudioWorkletNode(actx, 'loudness-meter');
  wklt.port.onmessage = (e) => {
    Object.assign(S, e.data);
    if (isFinite(e.data.momentary) && e.data.momentary > S.mMax) S.mMax = e.data.momentary;
    if (isFinite(e.data.shortTerm) && e.data.shortTerm > S.stMax) S.stMax = e.data.shortTerm;
    histPush(isFinite(e.data.shortTerm) ? e.data.shortTerm : -Infinity);
  };

  ansr = actx.createAnalyser();
  ansr.fftSize = 8192;
  ansr.smoothingTimeConstant = 0.8;
  ansr.minDecibels = -100;
  ansr.maxDecibels = 0;

  src = actx.createMediaStreamSource(mstrm);
  src.connect(wklt);
  src.connect(ansr);
  S.running = true;

  const lbl = mstrm.getAudioTracks()[0]?.label || 'Audio input';
  setSt(lbl.length > 55 ? lbl.slice(0, 52) + '…' : lbl, 'ok');
  setSt2('SR: ' + actx.sampleRate + ' Hz');
  await loadDevices();
  startLoop();
}

function stopAudio() {
  if (raf) {
    cancelAnimationFrame(raf);
    raf = null;
  }
  try {
    if (src) src.disconnect();
  } catch (_) {
    // Best effort disconnect.
  }
  if (mstrm) mstrm.getTracks().forEach((t) => t.stop());
  if (actx) actx.close();
  actx = null;
  wklt = null;
  ansr = null;
  src = null;
  mstrm = null;
  S.running = false;
  S.momentary = -Infinity;
  S.shortTerm = -Infinity;
  setSt('Stopped — click START to resume', '');
  setSt2('');
}

async function doToggle() {
  const btn = document.getElementById('startBtn');
  if (!S.running) {
    btn.textContent = '…';
    btn.className = 'hbtn';
    try {
      await initAudio();
      btn.textContent = 'STOP';
      btn.className = 'hbtn on';
    } catch (err) {
      btn.textContent = 'START';
      btn.className = 'hbtn off';
      const msg = err && err.message ? err.message : String(err);
      setSt('Error: ' + msg, 'err');
      setSt2(String(err && err.stack ? err.stack : msg));
      console.error(err);
    }
  } else {
    stopAudio();
    btn.textContent = 'START';
    btn.className = 'hbtn off';
  }
}

function doReset() {
  if (wklt) wklt.port.postMessage('reset');
  S.integrated = -Infinity;
  S.lra = 0;
  S.truePeak = -Infinity;
  S.mMax = -Infinity;
  S.stMax = -Infinity;
  phM.v = -Infinity;
  phS.v = -Infinity;
  histBuf.fill(-Infinity);
  histHead = 0;
  histCount = 0;
}

function setTgt(t) {
  S.target = t === 'ebu' ? -23 : -14;
  document.getElementById('btnEbu').className = 'tbtn' + (t === 'ebu' ? ' on' : '');
  document.getElementById('btnStream').className = 'tbtn' + (t === 'stream' ? ' on' : '');
  document.getElementById('tgtVal').textContent = S.target;
}

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
  const tgt = S.target;
  const MV = S.momentary;
  const SV = S.shortTerm;
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

  ctx.fillStyle = '#030608';
  ctx.fillRect(0, 0, W, H);
  ctx.font = '8px "Share Tech Mono"';
  ctx.textAlign = 'right';

  for (const t of TICKS) {
    const y = vY(t.v);
    const isTgt = Math.abs(t.v - tgt) < 0.1;
    ctx.strokeStyle = t.clip ? '#ff444422' : isTgt ? '#4a80ff33' : t.maj ? '#12202e' : '#0d1720';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(PL, y);
    ctx.lineTo(W, y);
    ctx.stroke();
    if (t.maj || isTgt) {
      ctx.fillStyle = t.clip ? '#ff444490' : isTgt ? '#4a80ff' : '#243a52';
      ctx.fillText(t.lb, PL - 4, y + 3);
    }
  }

  ctx.strokeStyle = '#4a80ff';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 3]);
  ctx.beginPath();
  ctx.moveTo(PL, vY(tgt));
  ctx.lineTo(W, vY(tgt));
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.strokeStyle = '#ff444450';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PL, vY(0));
  ctx.lineTo(W, vY(0));
  ctx.stroke();

  function drawBar(bx, val) {
    ctx.fillStyle = '#090e16';
    ctx.fillRect(bx, PT, BW, TH);
    if (!isFinite(val)) return;
    const fr = mFrac(val);
    const bH = fr * TH;
    const bY = PT + TH - bH;
    const g = ctx.createLinearGradient(bx, bY, bx, PT + TH);
    if (val >= -6) {
      g.addColorStop(0, '#ff4444');
      g.addColorStop(0.35, '#ffb828');
      g.addColorStop(1, '#00e896');
    } else if (val >= -18) {
      g.addColorStop(0, '#e8c030');
      g.addColorStop(1, '#00e896');
    } else {
      g.addColorStop(0, '#00e896');
      g.addColorStop(1, '#006848');
    }
    ctx.fillStyle = g;
    ctx.fillRect(bx, bY, BW, bH);
    const ec = val >= -6 ? '#ff7777' : val >= -18 ? '#ffd060' : '#40ffb0';
    ctx.fillStyle = ec;
    ctx.fillRect(bx, bY, BW, 1.5);
  }

  const now = Date.now();
  if (isFinite(MV) && MV > phM.v) {
    phM.v = MV;
    phM.t = now + 2500;
  }
  if (now > phM.t) phM.v = -Infinity;
  if (isFinite(SV) && SV > phS.v) {
    phS.v = SV;
    phS.t = now + 2500;
  }
  if (now > phS.t) phS.v = -Infinity;

  drawBar(MX, MV);
  drawBar(SX, SV);

  function phLine(bx, phv) {
    if (!isFinite(phv)) return;
    const y = vY(phv);
    const c = phv >= -6 ? '#ff5555' : phv >= -18 ? '#ffc040' : '#00e896';
    ctx.strokeStyle = c;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(bx, y);
    ctx.lineTo(bx + BW, y);
    ctx.stroke();
  }

  phLine(MX, phM.v);
  phLine(SX, phS.v);
  const fmtV = (v) => (isFinite(v) && v > -90 ? v.toFixed(1) : '—');
  ctx.font = '8px "Share Tech Mono"';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#2a4060';
  ctx.fillText('M', MX + BW / 2, H - 8);
  ctx.fillText('S', SX + BW / 2, H - 8);
  ctx.fillStyle = isFinite(MV) ? '#6a90a8' : '#1e2d3e';
  ctx.fillText(fmtV(MV), MX + BW / 2, H - 1);
  ctx.fillStyle = isFinite(SV) ? '#6a90a8' : '#1e2d3e';
  ctx.fillText(fmtV(SV), SX + BW / 2, H - 1);
  ctx.restore();
}

let spkData = null;
let spkAge = null;
let spkW = 0;

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
  const SR = analyser.context.sampleRate;
  const BL = analyser.frequencyBinCount;
  const fdt = new Float32Array(BL);
  analyser.getFloatFrequencyData(fdt);

  const LOG20 = Math.log10(20);
  const LOG20K = Math.log10(20000);
  const DBMIN = -100;
  const DBMAX = 0;
  const fToX = (f) => PADL + (Math.log10(Math.max(20, f)) - LOG20) / (LOG20K - LOG20) * CW;
  const dToY = (d) => PADT + (1 - (d - DBMIN) / (DBMAX - DBMIN)) * CH;
  const fToBin = (f) => Math.round(f / (SR / 2) * BL);

  if (!spkData || spkW !== CW) {
    spkData = new Float32Array(CW).fill(DBMIN);
    spkAge = new Float32Array(CW).fill(0);
    spkW = CW;
  }

  ctx.fillStyle = '#030608';
  ctx.fillRect(0, 0, W, H);
  const fGrid = [20, 30, 40, 50, 70, 100, 150, 200, 300, 500, 700, 1000, 1500, 2000, 3000, 5000, 7000, 10000, 15000, 20000];
  const fLbls = { 20: '20', 50: '50', 100: '100', 200: '200', 500: '500', 1000: '1k', 2000: '2k', 5000: '5k', 10000: '10k', 20000: '20k' };
  for (const f of fGrid) {
    const x = fToX(f);
    if (x < PADL || x > PADL + CW) continue;
    ctx.strokeStyle = f in fLbls ? '#1a2d40' : '#0e1a25';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(x, PADT);
    ctx.lineTo(x, PADT + CH);
    ctx.stroke();
  }
  for (const d of [-100, -84, -72, -60, -48, -36, -24, -12, -6, 0]) {
    const y = dToY(d);
    if (y < PADT || y > PADT + CH) continue;
    ctx.strokeStyle = d === 0 ? '#ff444428' : '#1a2d40';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(PADL, y);
    ctx.lineTo(PADL + CW, y);
    ctx.stroke();
  }

  const pts = [];
  for (let px = 0; px < CW; px++) {
    const frac = px / CW;
    const freq = Math.pow(10, LOG20 + frac * (LOG20K - LOG20));
    const bin = fToBin(freq);
    if (bin <= 0 || bin >= BL) continue;
    const span = Math.max(1, Math.round(bin * 0.015));
    let maxDb = DBMIN;
    for (let b = Math.max(1, bin - span); b <= Math.min(BL - 1, bin + span); b++) {
      if (fdt[b] > maxDb) maxDb = fdt[b];
    }
    maxDb = Math.max(DBMIN, Math.min(DBMAX, maxDb));
    pts.push({ px, db: maxDb });
    if (maxDb > spkData[px]) {
      spkData[px] = maxDb;
      spkAge[px] = 0;
    } else if (++spkAge[px] > 120) {
      spkData[px] = Math.max(DBMIN, spkData[px] - 0.3);
    }
  }

  if (pts.length > 1) {
    ctx.beginPath();
    ctx.moveTo(PADL + pts[0].px, PADT + CH);
    for (const p of pts) ctx.lineTo(PADL + p.px, dToY(p.db));
    ctx.lineTo(PADL + pts[pts.length - 1].px, PADT + CH);
    ctx.closePath();
    const gf = ctx.createLinearGradient(0, PADT, 0, PADT + CH);
    gf.addColorStop(0, '#ff444455');
    gf.addColorStop(0.18, '#ffb82838');
    gf.addColorStop(0.5, '#00e89650');
    gf.addColorStop(1, '#005c3818');
    ctx.fillStyle = gf;
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(PADL + pts[0].px, dToY(pts[0].db));
    for (const p of pts) ctx.lineTo(PADL + p.px, dToY(p.db));
    ctx.strokeStyle = '#00e896';
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
    ctx.strokeStyle = '#00e89638';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  ctx.strokeStyle = '#12202e';
  ctx.lineWidth = 1;
  ctx.strokeRect(PADL, PADT, CW, CH);
  ctx.font = '9px "Barlow Condensed"';
  ctx.fillStyle = '#2a4060';
  ctx.textAlign = 'center';
  for (const [f, lbl] of Object.entries(fLbls)) {
    const x = fToX(Number(f));
    if (x >= PADL && x <= PADL + CW) ctx.fillText(lbl, x, H - 4);
  }
  ctx.textAlign = 'right';
  for (const d of [-84, -72, -60, -48, -36, -24, -12, -6, 0]) {
    const y = dToY(d);
    if (y >= PADT && y <= PADT + CH) {
      ctx.fillStyle = d === 0 ? '#ff444480' : '#2a4060';
      ctx.fillText(d.toString(), PADL - 4, y + 3);
    }
  }
  ctx.restore();
}

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
  const PADL = 42;
  const PADR = 6;
  const PADT = 4;
  const PADB = 18;
  const CW = W - PADL - PADR;
  const CH = H - PADT - PADB;
  const tgt = S.target;
  const DBMIN = -60;
  const DBMAX = 3;
  const DBRNG = DBMAX - DBMIN;
  const dToY = (d) => PADT + (1 - (Math.max(DBMIN, Math.min(DBMAX, d)) - DBMIN) / DBRNG) * CH;

  ctx.fillStyle = '#030608';
  ctx.fillRect(0, 0, W, H);

  for (const d of [-60, -48, -36, -24, -18, -12, -6, 0, 3]) {
    const y = dToY(d);
    ctx.strokeStyle = Math.abs(d - tgt) < 0.1 ? '#4a80ff28' : d === 0 ? '#ff444428' : '#12202e';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(PADL, y);
    ctx.lineTo(PADL + CW, y);
    ctx.stroke();
  }

  ctx.strokeStyle = '#4a80ff';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 3]);
  ctx.beginPath();
  ctx.moveTo(PADL, dToY(tgt));
  ctx.lineTo(PADL + CW, dToY(tgt));
  ctx.stroke();
  ctx.setLineDash([]);

  if (histCount > 1) {
    const n = Math.min(histCount, CW * 4);
    const pxPerSamp = CW / n;
    const sampPer30 = 300;
    ctx.font = '9px "Barlow Condensed"';
    ctx.fillStyle = '#1e3248';
    ctx.textAlign = 'center';
    for (let i = 0; i * sampPer30 < n; i++) {
      const sampFromEnd = i * sampPer30;
      const px = CW - sampFromEnd * pxPerSamp;
      if (px < 0 || px > CW) continue;
      ctx.strokeStyle = '#12202e';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(PADL + px, PADT);
      ctx.lineTo(PADL + px, PADT + CH);
      ctx.stroke();
      const secs = i * 30;
      const lbl = secs >= 60 ? Math.floor(secs / 60) + 'm' + (secs % 60 ? secs % 60 + 's' : '') : secs + 's';
      ctx.fillStyle = '#2a4060';
      ctx.fillText(lbl, PADL + px, H - 4);
    }

    const pts = [];
    for (let i = 0; i < n; i++) {
      const idx = (histHead - n + i + HIST_MAX) % HIST_MAX;
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
      gf.addColorStop(0, '#4a80ff50');
      gf.addColorStop(1, '#4a80ff08');
      ctx.fillStyle = gf;
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(PADL + pts[0].px, dToY(pts[0].v));
      for (const p of pts) ctx.lineTo(PADL + p.px, dToY(p.v));
      ctx.strokeStyle = '#6090ff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    if (isFinite(S.integrated)) {
      const iy = dToY(S.integrated);
      ctx.strokeStyle = '#20d4e8';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 4]);
      ctx.beginPath();
      ctx.moveTo(PADL, iy);
      ctx.lineTo(PADL + CW, iy);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.font = '8px "Share Tech Mono"';
      ctx.fillStyle = '#20d4e8';
      ctx.textAlign = 'left';
      ctx.fillText('INT ' + S.integrated.toFixed(1), PADL + 4, iy - 3);
    }
  }

  ctx.strokeStyle = '#12202e';
  ctx.lineWidth = 1;
  ctx.strokeRect(PADL, PADT, CW, CH);
  ctx.font = '8px "Share Tech Mono"';
  ctx.textAlign = 'right';
  for (const d of [-48, -36, -24, -18, -12, -6, 0]) {
    const y = dToY(d);
    if (y < PADT || y > PADT + CH) continue;
    ctx.fillStyle = '#2a4060';
    ctx.fillText(d.toString(), PADL - 4, y + 3);
  }
  ctx.restore();
}

function fmtL(v) {
  return isFinite(v) && v > -90 ? v.toFixed(1) : '—';
}

function updateReadouts() {
  const I = S.integrated;
  const TP = S.truePeak;
  const lra = S.lra;
  const MV = S.momentary;
  const SV = S.shortTerm;
  const MM = S.mMax;
  const SM = S.stMax;
  const TG = S.target;

  document.getElementById('intVal').textContent = fmtL(I);
  document.getElementById('tpVal').textContent = fmtL(TP);
  document.getElementById('lraVal').textContent = lra > 0.1 ? lra.toFixed(1) : '—';
  document.getElementById('mVal').textContent = fmtL(MV);
  document.getElementById('stVal').textContent = fmtL(SV);
  document.getElementById('mMaxVal').textContent = fmtL(MM);
  document.getElementById('stMaxVal').textContent = fmtL(SM);
  document.getElementById('tgtVal').textContent = TG;

  document.getElementById('psrVal').textContent = isFinite(TP) && isFinite(SV) ? Math.abs(TP - SV).toFixed(1) : '—';
  document.getElementById('plrVal').textContent = isFinite(TP) && isFinite(I) ? Math.abs(TP - I).toFixed(1) : '—';
  document.getElementById('dynVal').textContent = isFinite(MV) && isFinite(SV) ? Math.abs(MV - SV).toFixed(1) : '—';

  const tpBox = document.getElementById('tpBox');
  tpBox.className = 'rdout' + (isFinite(TP) ? (TP >= 0 ? ' c-bad' : TP >= -1 ? ' c-warn' : '') : '');
  const intBox = document.getElementById('intBox');
  if (isFinite(I)) {
    const d = I - TG;
    intBox.className = 'rdout wide' + (d > 1.5 ? ' c-warn' : d >= -1.5 ? ' c-ok' : '');
  } else {
    intBox.className = 'rdout wide';
  }
}

function startLoop() {
  const mc = document.getElementById('mCvs');
  const sc = document.getElementById('sCvs');
  const hc = document.getElementById('hCvs');
  function frame() {
    raf = requestAnimationFrame(frame);
    drawMeters(mc);
    if (ansr) {
      drawSpectrum(sc, ansr);
    } else {
      const dpr = window.devicePixelRatio || 1;
      const ctx = sc.getContext('2d');
      ctx.fillStyle = '#030608';
      ctx.fillRect(0, 0, sc.width / dpr, sc.height / dpr);
    }
    drawHistory(hc);
    updateReadouts();
  }
  frame();
}

function initStatic() {
  requestAnimationFrame(() => {
    drawMeters(document.getElementById('mCvs'));
    for (const id of ['sCvs', 'hCvs']) {
      const cvs = document.getElementById(id);
      const dpr = window.devicePixelRatio || 1;
      const W = cvs.offsetWidth;
      const H = cvs.offsetHeight;
      if (!W || !H) return;
      cvs.width = Math.round(W * dpr);
      cvs.height = Math.round(H * dpr);
      const ctx = cvs.getContext('2d');
      ctx.fillStyle = '#030608';
      ctx.fillRect(0, 0, W, H);
    }
  });
}

function bindUi() {
  document.getElementById('btnEbu').addEventListener('click', () => setTgt('ebu'));
  document.getElementById('btnStream').addEventListener('click', () => setTgt('stream'));
  document.getElementById('startBtn').addEventListener('click', doToggle);
  document.getElementById('resetBtn').addEventListener('click', doReset);
}

function bootstrap() {
  try {
    bindUi();
    initStatic();
    loadDevices();
    setSt2('Ready');
  } catch (err) {
    // 如果脚本在页面初始化阶段就失败（例如 DOM id 不匹配），也要可见地提示。
    console.error(err);
    const msg = err && err.message ? err.message : String(err);
    try {
      setSt('Init error: ' + msg, 'err');
      setSt2(String(err && err.stack ? err.stack : msg));
    } catch (_) {}
  }
}

bootstrap();
