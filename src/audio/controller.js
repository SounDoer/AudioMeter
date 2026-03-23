(function () {
  const AM = window.AM || (window.AM = {});

  const S = AM.state.S;

  // Worklet 代码内联兜底（保证 file:// 场景可用）
  const WKLT = `'use strict';
class BQ{
  constructor(b0,b1,b2,a1,a2){this.b0=b0;this.b1=b1;this.b2=b2;this.a1=a1;this.a2=a2;this.x1=0;this.x2=0;this.y1=0;this.y2=0;}
  tick(x){const y=this.b0*x+this.b1*this.x1+this.b2*this.x2-this.a1*this.y1-this.a2*this.y2;this.x2=this.x1;this.x1=x;this.y2=this.y1;this.y1=y;return y;}
}
function kwCoeffs(sr){
  const Vh=Math.pow(10,3.999843853973347/20),Vb=Math.pow(Vh,0.4996667741545416);
  const f0=1681.974450955533,Q1=0.7071752369554196,K1=Math.tan(Math.PI*f0/sr),d0=1+K1/Q1+K1*K1;
  const s1={b0:(Vh+Vb*K1/Q1+K1*K1)/d0,b1:2*(K1*K1-Vh)/d0,b2:(Vh-Vb*K1/Q1+K1*K1)/d0,a1:2*(K1*K1-1)/d0,a2:(1-K1/Q1+K1*K1)/d0};
  const f1=38.13547087602444,Q2=0.5003270373238773,K2=Math.tan(Math.PI*f1/sr),d1=1+K2/Q2+K2*K2;
  const s2={b0:1,b1:-2,b2:1,a1:2*(K2*K2-1)/d1,a2:(1-K2/Q2+K2*K2)/d1};
  return{s1,s2};
}
class LoudnessMeter extends AudioWorkletProcessor{
  constructor(){
    super();
    const sr=sampleRate,c=kwCoeffs(sr);
    const mf=s=>[new BQ(s.s1.b0,s.s1.b1,s.s1.b2,s.s1.a1,s.s1.a2),new BQ(s.s2.b0,s.s2.b1,s.s2.b2,s.s2.a1,s.s2.a2)];
    this.kf=[mf(c),mf(c)];
    this.bsz=Math.round(sr*0.1);this.ba=[0,0];this.bn=0;
    this.RN=60;this.ring=new Float64Array(this.RN*2);this.rh=0;this.rc=0;
    this.ibl=[];this.sth=[];this.tpMax=0;this.tpBlock=0;
    this._initTP();this.tpH=[new Float64Array(this.tpT),new Float64Array(this.tpT)];this.tpWP=[0,0];
    this.port.onmessage=e=>{if(e.data==='reset')this._reset();};
  }
  _reset(){this.ibl=[];this.sth=[];this.tpMax=0;this.ring.fill(0);this.rh=0;this.rc=0;}
  _initTP(){
    const P=4,T=32,N=P*T,h=new Float64Array(N),ctr=(N-1)/2;
    for(let i=0;i<N;i++){const n=i-ctr,x=n/P,sinc=Math.abs(x)<1e-12?1:Math.sin(Math.PI*x)/(Math.PI*x);
      const bh=0.35875-0.48829*Math.cos(2*Math.PI*i/(N-1))+0.14128*Math.cos(4*Math.PI*i/(N-1))-0.01168*Math.cos(6*Math.PI*i/(N-1));
      h[i]=sinc*bh;}
    this.tpPh=[];
    for(let p=0;p<P;p++){const ph=new Float64Array(T);for(let t=0;t<T;t++)ph[t]=h[p+t*P];
      const s=ph.reduce((a,v)=>a+v,0);if(Math.abs(s)>1e-10)for(let t=0;t<T;t++)ph[t]/=s;this.tpPh.push(ph);}
    this.tpT=T;this.tpP=P;
  }
  _tpSample(x,ch){
    const T=this.tpT,H=this.tpH[ch],wp=this.tpWP[ch];H[wp]=x;this.tpWP[ch]=(wp+1)%T;
    let mx=Math.abs(x);
    for(let p=1;p<this.tpP;p++){const ph=this.tpPh[p];let y=0;for(let t=0;t<T;t++)y+=ph[t]*H[(wp-t+T)%T];if(Math.abs(y)>mx)mx=Math.abs(y);}
    return mx;
  }
  _lufs(m0,m1){const s=m0+m1;return s<=0?-Infinity:-0.691+10*Math.log10(s);}
  _integrated(){
    const b=this.ibl;if(!b.length)return -Infinity;
    let s0=0,s1=0,n=0;for(const x of b){if(this._lufs(x[0],x[1])>-70){s0+=x[0];s1+=x[1];n++;}}
    if(!n)return -Infinity;
    const Ga=-0.691+10*Math.log10(s0/n+s1/n)-10;
    s0=s1=n=0;for(const x of b){const l=this._lufs(x[0],x[1]);if(l>-70&&l>Ga){s0+=x[0];s1+=x[1];n++;}}
    if(!n)return -Infinity;
    return -0.691+10*Math.log10(s0/n+s1/n);
  }
  _lra(){
    const h=this.sth.filter(l=>isFinite(l)&&l>-70);if(h.length<2)return 0;
    const mean=h.reduce((s,l)=>s+Math.pow(10,l/10),0)/h.length;
    const Gr=10*Math.log10(mean)-20;
    const r=h.filter(l=>l>Gr).sort((a,b)=>a-b);
    if(r.length<2)return 0;return Math.max(0,r[Math.floor(r.length*0.95)]-r[Math.floor(r.length*0.10)]);
  }
  process(inputs){
    const inp=inputs[0];if(!inp||!inp.length)return true;
    const nc=Math.min(inp.length,2),len=inp[0].length;
    for(let i=0;i<len;i++){
      for(let ch=0;ch<2;ch++){
        const x=ch<nc?inp[ch][i]:(nc===1?inp[0][i]:0);
        const kw=this.kf[ch][1].tick(this.kf[ch][0].tick(x));this.ba[ch]+=kw*kw;
        const tp=this._tpSample(x,ch);if(tp>this.tpBlock)this.tpBlock=tp;
      }
      if(++this.bn>=this.bsz){
        const m0=this.ba[0]/this.bn,m1=this.ba[1]/this.bn;
        this.ring[this.rh*2]=m0;this.ring[this.rh*2+1]=m1;
        this.rh=(this.rh+1)%this.RN;this.rc=Math.min(this.rc+1,this.RN);
        this.ibl.push([m0,m1]);if(this.ibl.length>36000)this.ibl.shift();
        let a0=0,a1=0,an=0;
        for(let b=0;b<Math.min(4,this.rc);b++){const idx=((this.rh-1-b+this.RN)%this.RN)*2;a0+=this.ring[idx];a1+=this.ring[idx+1];an++;}
        const momentary=an?this._lufs(a0/an,a1/an):-Infinity;
        a0=a1=an=0;
        for(let b=0;b<Math.min(30,this.rc);b++){const idx=((this.rh-1-b+this.RN)%this.RN)*2;a0+=this.ring[idx];a1+=this.ring[idx+1];an++;}
        const shortTerm=an?this._lufs(a0/an,a1/an):-Infinity;
        if(isFinite(shortTerm)){this.sth.push(shortTerm);if(this.sth.length>36000)this.sth.shift();}
        if(this.tpBlock>this.tpMax)this.tpMax=this.tpBlock;
        this.port.postMessage({momentary,shortTerm,integrated:this._integrated(),lra:this._lra(),truePeak:this.tpMax>0?20*Math.log10(this.tpMax):-Infinity});
        this.ba[0]=this.ba[1]=0;this.bn=0;this.tpBlock=0;
      }
    }
    return true;
  }
}
registerProcessor('loudness-meter',LoudnessMeter);
`;

  async function loadDevices() {
    try {
      const devs = await navigator.mediaDevices.enumerateDevices();
      const ins = devs.filter((d) => d.kind === 'audioinput');

      const sel = document.getElementById('devSel');
      if (!sel) return;

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
      // 忽略枚举失败（通常是权限未就绪）
    }
  }

  function setTgt(t) {
    S.target = t === 'ebu' ? -23 : -14;

    const btnEbu = document.getElementById('btnEbu');
    const btnStream = document.getElementById('btnStream');
    const tgtVal = document.getElementById('tgtVal');
    if (btnEbu) btnEbu.className = 'tbtn' + (t === 'ebu' ? ' on' : '');
    if (btnStream) btnStream.className = 'tbtn' + (t === 'stream' ? ' on' : '');
    if (tgtVal) tgtVal.textContent = S.target;
  }

  async function initAudio() {
    AM.ui.setSt('Requesting microphone...', 'warn');

    const devId = document.getElementById('devSel')?.value;
    AM.runtime.mstrm = await navigator.mediaDevices.getUserMedia({
      audio: {
        deviceId: devId ? { exact: devId } : undefined,
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    });

    AM.runtime.actx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' });

    // worklet 加载：优先外部文件；file:// 场景失败则 data: URL 内联兜底。
    try {
      AM.ui.setSt2('Loading worklet...');
      await AM.runtime.actx.audioWorklet.addModule('./worklets/loudness-meter.js');
    } catch (errWorklet) {
      console.warn('Worklet external load failed, fallback to inline WKLT:', errWorklet);
      AM.ui.setSt2('Worklet inline fallback...');
      const b64 = btoa(unescape(encodeURIComponent(WKLT)));
      await AM.runtime.actx.audioWorklet.addModule('data:application/javascript;base64,' + b64);
    }

    AM.runtime.wklt = new AudioWorkletNode(AM.runtime.actx, 'loudness-meter');
    AM.runtime.wklt.port.onmessage = (e) => {
      const d = e.data || {};
      Object.assign(S, d);

      if (isFinite(d.momentary) && d.momentary > S.mMax) S.mMax = d.momentary;
      if (isFinite(d.shortTerm) && d.shortTerm > S.stMax) S.stMax = d.shortTerm;
      AM.state.histPush(isFinite(d.shortTerm) ? d.shortTerm : -Infinity);
    };

    AM.runtime.ansr = AM.runtime.actx.createAnalyser();
    AM.runtime.ansr.fftSize = 8192;
    AM.runtime.ansr.smoothingTimeConstant = 0.8;
    AM.runtime.ansr.minDecibels = -100;
    AM.runtime.ansr.maxDecibels = 0;

    // Vectorscope: independent stereo time-domain analyzers
    AM.runtime.vAnL = AM.runtime.actx.createAnalyser();
    AM.runtime.vAnR = AM.runtime.actx.createAnalyser();
    AM.runtime.vAnL.fftSize = 2048;
    AM.runtime.vAnR.fftSize = 2048;
    AM.runtime.vAnL.smoothingTimeConstant = 0.1;
    AM.runtime.vAnR.smoothingTimeConstant = 0.1;

    AM.runtime.src = AM.runtime.actx.createMediaStreamSource(AM.runtime.mstrm);
    AM.runtime.src.connect(AM.runtime.wklt);
    AM.runtime.src.connect(AM.runtime.ansr);
    AM.runtime.split = AM.runtime.actx.createChannelSplitter(2);
    AM.runtime.src.connect(AM.runtime.split);
    AM.runtime.split.connect(AM.runtime.vAnL, 0);
    AM.runtime.split.connect(AM.runtime.vAnR, 1);

    S.running = true;

    const lbl = AM.runtime.mstrm.getAudioTracks()[0]?.label || 'Audio input';
    AM.ui.setSt(lbl.length > 55 ? lbl.slice(0, 52) + '…' : lbl, 'ok');
    AM.ui.setSt2('SR: ' + AM.runtime.actx.sampleRate + ' Hz');

    await loadDevices();
    AM.renderLoop.startLoop();
  }

  function stopAudio() {
    AM.renderLoop.stopLoop();

    try {
      if (AM.runtime.src) AM.runtime.src.disconnect();
    } catch (_) {}

    if (AM.runtime.mstrm) {
      AM.runtime.mstrm.getTracks().forEach((t) => t.stop());
    }
    if (AM.runtime.actx) AM.runtime.actx.close();

    AM.runtime.actx = null;
    AM.runtime.wklt = null;
    AM.runtime.ansr = null;
    AM.runtime.split = null;
    AM.runtime.vAnL = null;
    AM.runtime.vAnR = null;
    AM.runtime.src = null;
    AM.runtime.mstrm = null;

    S.running = false;
    S.momentary = -Infinity;
    S.shortTerm = -Infinity;

    AM.ui.setSt('Stopped — click START to resume', '');
    AM.ui.setSt2('');
  }

  async function doToggle() {
    const btn = document.getElementById('startBtn');
    if (!btn) return;

    if (!S.running) {
      btn.textContent = '…';
      btn.className = 'hbtn';
      try {
        await initAudio();
        btn.textContent = 'STOP';
        btn.className = 'hbtn on';
      } catch (err) {
        const msg = err && err.message ? err.message : String(err);
        btn.textContent = 'START';
        btn.className = 'hbtn off';
        AM.ui.setSt('Error: ' + msg, 'err');
        AM.ui.setSt2(String(err && err.stack ? err.stack : msg));
        console.error(err);
      }
    } else {
      stopAudio();
      btn.textContent = 'START';
      btn.className = 'hbtn off';
    }
  }

  function doReset() {
    if (AM.runtime.wklt) AM.runtime.wklt.port.postMessage('reset');

    S.integrated = -Infinity;
    S.lra = 0;
    S.truePeak = -Infinity;
    S.mMax = -Infinity;
    S.stMax = -Infinity;

    if (AM.renderers.meters && AM.renderers.meters.resetPeakHold) AM.renderers.meters.resetPeakHold();
    AM.state.resetHistory();
  }

  AM.audio = {
    loadDevices,
    setTgt,
    doToggle,
    doReset,
  };
})();

