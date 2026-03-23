(function () {
  // 为了兼容直接用 file:// 打开，这里不使用 ES modules。
  // 各模块通过挂到 window.AM 上来解耦。
  window.AM = window.AM || {};
})();

