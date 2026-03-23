# AudioMeter

当前仓库包含两个入口：

- `audiometer_v0d0.html`：原始单文件版本（保持不变）
- `audiometer_modular.html`：新增模块化版本（逻辑拆分到 `src/` 与 `worklets/`）

## 模块化版本结构

- `worklets/loudness-meter.js`：AudioWorklet（BS.1770-4 相关响度计算）
- `src/audiometer-app.js`：主线程状态管理、音频控制、渲染循环、UI 绑定

## 运行方式

建议通过本地静态服务打开项目根目录，再访问：

- `audiometer_v0d0.html`（原版）
- `audiometer_modular.html`（模块化版）

例如可使用任意静态服务工具（Python `http.server`、Node `serve` 等）。