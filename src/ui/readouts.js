(function () {
  const AM = window.AM || (window.AM = {});

  AM.ui = AM.ui || {};
  AM.ui.fmtL = function fmtL(v) {
    return isFinite(v) && v > -90 ? v.toFixed(1) : '—';
  };
  AM.ui.fmtP = function fmtP(v) {
    return isFinite(v) ? v.toFixed(1) : '—';
  };

  AM.ui.updateReadouts = function updateReadouts() {
    const SS = AM.state.getDisplayState ? AM.state.getDisplayState() : AM.state.S;
    const M = SS.momentary;
    const ST = SS.shortTerm;
    const I = SS.integrated;
    const MMAX = SS.mMax;
    const STMAX = SS.stMax;
    const LRA = SS.lra;
    const TP = SS.truePeak;
    const TPM = SS.truePeakMax;

    const PSR = isFinite(TP) && isFinite(ST) ? TP - ST : -Infinity;
    const PLR = isFinite(TPM) && isFinite(I) ? TPM - I : -Infinity;

    const setText = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };

    setText('mVal', AM.ui.fmtL(M));
    setText('stVal', AM.ui.fmtL(ST));
    setText('intVal', AM.ui.fmtL(I));
    setText('mMaxVal', AM.ui.fmtL(MMAX));
    setText('stMaxVal', AM.ui.fmtL(STMAX));
    setText('tpMaxVal', AM.ui.fmtL(TPM));
    setText('lraVal', isFinite(LRA) && LRA > 0 ? LRA.toFixed(1) : '—');
    setText('psrVal', AM.ui.fmtP(PSR));
    setText('plrVal', AM.ui.fmtP(PLR));
  };
})();

