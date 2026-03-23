(function () {
  const AM = window.AM || (window.AM = {});

  AM.ui = AM.ui || {};
  AM.ui.fmtL = function fmtL(v) {
    return isFinite(v) && v > -90 ? v.toFixed(1) : '—';
  };

  AM.ui.updateReadouts = function updateReadouts() {
    const S = AM.state.S;

    const TP = S.truePeak;
    const TG = S.target;

    document.getElementById('tpVal').textContent = AM.ui.fmtL(TP);
    document.getElementById('tgtVal').textContent = TG;

    const tpBox = document.getElementById('tpBox');
    tpBox.className = 'rdout wide' + (isFinite(TP) ? (TP >= 0 ? ' c-bad' : TP >= -1 ? ' c-warn' : '') : '');
  };
})();

