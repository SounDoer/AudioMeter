(function () {
  const AM = window.AM || (window.AM = {});

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

  function resetHistory() {
    histBuf.fill(-Infinity);
    histHead = 0;
    histCount = 0;
  }

  AM.state = {
    S,
    HIST_MAX,
    histBuf,
    get histHead() {
      return histHead;
    },
    get histCount() {
      return histCount;
    },
    histPush,
    resetHistory,
  };
})();

