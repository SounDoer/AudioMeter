(function () {
  const AM = window.AM || (window.AM = {});

  AM.ui = AM.ui || {};
  AM.ui.fmtL = function fmtL(v) {
    return isFinite(v) && v > -90 ? v.toFixed(1) : '—';
  };

  AM.ui.updateReadouts = function updateReadouts() {
    const S = AM.state.S;

    const I = S.integrated;
    const TP = S.truePeak;
    const lra = S.lra;
    const MV = S.momentary;
    const SV = S.shortTerm;
    const MM = S.mMax;
    const SM = S.stMax;
    const TG = S.target;

    document.getElementById('intVal').textContent = AM.ui.fmtL(I);
    document.getElementById('tpVal').textContent = AM.ui.fmtL(TP);
    document.getElementById('lraVal').textContent = lra > 0.1 ? lra.toFixed(1) : '—';
    document.getElementById('mVal').textContent = AM.ui.fmtL(MV);
    document.getElementById('stVal').textContent = AM.ui.fmtL(SV);
    document.getElementById('mMaxVal').textContent = AM.ui.fmtL(MM);
    document.getElementById('stMaxVal').textContent = AM.ui.fmtL(SM);
    document.getElementById('tgtVal').textContent = TG;

    document.getElementById('psrVal').textContent = isFinite(TP) && isFinite(SV) ? Math.abs(TP - SV).toFixed(1) : '—';
    document.getElementById('plrVal').textContent = isFinite(TP) && isFinite(I) ? Math.abs(TP - I).toFixed(1) : '—';
    document.getElementById('dynVal').textContent = isFinite(MV) && isFinite(SV) ? Math.abs(MV - SV).toFixed(1) : '—';

    const tpBox = document.getElementById('tpBox');
    tpBox.className =
      'rdout' +
      (isFinite(TP) ? (TP >= 0 ? ' c-bad' : TP >= -1 ? ' c-warn' : '') : '');

    const intBox = document.getElementById('intBox');
    if (isFinite(I)) {
      const d = I - TG;
      intBox.className = 'rdout wide' + (d > 1.5 ? ' c-warn' : d >= -1.5 ? ' c-ok' : '');
    } else {
      intBox.className = 'rdout wide';
    }
  };
})();

