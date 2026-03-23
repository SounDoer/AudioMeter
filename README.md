# AudioMeter

当前仓库包含两个入口：

- `audiometer_v0d0.html`：原始单文件版本（保持不变）
- `audiometer.html`：模块化版本（逻辑拆分到 `src/` 与 `worklets/`）

## 模块化版本结构

- `worklets/loudness-meter.js`：AudioWorklet（BS.1770-4 相关响度计算）
- `src/audio/controller.js`：音频控制（mic / AudioContext / Worklet / analyser）
- `src/renderers/`：Canvas 渲染器（Meters / Spectrum / History）
- `src/ui/`：状态栏与读数面板更新
- `src/render-loop.js`：渲染循环
- `src/main.js`：主入口（绑定按钮、初始化画布、加载设备）

## 运行方式

建议通过本地静态服务打开项目根目录，再访问：

- `audiometer_v0d0.html`（原版）
- `audiometer.html`（模块化版）

例如可使用任意静态服务工具（Python `http.server`、Node `serve` 等）。