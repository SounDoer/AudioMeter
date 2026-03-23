(function () {
  const AM = window.AM || (window.AM = {});

  AM.ui = AM.ui || {};

  AM.ui.setSt = function setSt(msg, cls) {
    const e = document.getElementById('stMsg');
    if (!e) return;
    e.textContent = msg;
    e.className = 'st' + (cls ? ' ' + cls : '');
  };

  AM.ui.setSt2 = function setSt2(msg) {
    const e = document.getElementById('stDev');
    if (!e) return;
    e.textContent = msg;
  };
})();

