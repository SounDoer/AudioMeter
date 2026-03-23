(function () {
  const AM = window.AM || (window.AM = {});

  AM.ui = AM.ui || {};
  AM.ui.fmtL = function fmtL(v) {
    return isFinite(v) && v > -90 ? v.toFixed(1) : '—';
  };

  AM.ui.updateReadouts = function updateReadouts() {
    const S = AM.state.S;

    const SP = S.samplePeak;
    const TPM = S.truePeakMax;
    const TG = S.target;

    document.getElementById('tpVal').textContent = AM.ui.fmtL(SP);
    const tpMaxMeta = document.getElementById('tpMaxMeta');
    if (tpMaxMeta) tpMaxMeta.textContent = 'TP MAX ' + AM.ui.fmtL(TPM) + ' dBTP';
    document.getElementById('tgtVal').textContent = TG;

    const tpBox = document.getElementById('tpBox');
    tpBox.className = 'rdout wide' + (isFinite(SP) ? (SP >= 0 ? ' c-bad' : SP >= -1 ? ' c-warn' : '') : '');
  };
})();

