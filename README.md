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

## 音频输入：麦克风 vs 系统回放（可选虚拟声卡）

### 你是否需要先装“虚拟声卡”？

不一定。

- 默认情况下，页面会通过浏览器 `navigator.mediaDevices.getUserMedia()` 读取“音频输入设备”（也就是你系统里的麦克风/Line-in/任意录音设备）。因此不装虚拟声卡也可以运行，只要浏览器能拿到录音权限。
- 如果你想测的是“电脑正在播放的声音”（系统回放/What U Hear），通常需要先安装虚拟音频路由软件，把“系统播放”转成一个可被当作“音频输入设备”的虚拟声卡/回放到输入设备。

### 模块化版本 `audiometer.html`

- 当前实现没有音频输入设备下拉选择（会使用系统“默认输入设备”）。
- 所以：安装好虚拟声卡后，把对应的虚拟设备设置成系统“默认输入”，然后刷新页面并允许麦克风权限。

### 原版 `audiometer_v0d0.html`

- 页面里有输入设备下拉框（`devSel`）。
- 安装好虚拟声卡后，在下拉框选择对应的虚拟输入设备即可。

## Windows（推荐方案）

> 目标：把“系统回放”路由成浏览器可选的“录音/输入设备”（虚拟麦克风）。

1. 安装 `VB-CABLE`（VB-Audio Virtual Cables）
   - Virtual Cables 页面：https://vb-audio.com/Cable/VirtualCables.htm

配置要点（简要）：

- 把“系统播放设备/默认输出”切到 `VB-CABLE` 的“Output”（让应用/系统的声音流入到虚拟线缆）。
- 把 `VB-CABLE` 的“Input”作为浏览器可用的“音频输入设备”（模块化版本：设为系统“默认输入”；原版：在 `audiometer_v0d0.html` 的 `devSel` 下拉框选择对应虚拟输入）。
- 刷新页面并授予录音权限。

## macOS（推荐方案）

> 目标：把“系统播放”路由成浏览器可选的“录音/输入设备”。

1. 安装 `BlackHole`（Existential Audio）
   - 官方下载页：https://existential.audio/blackhole/download/
2. 配置要点
   - 打开系统设置 -> 声音 -> 输入，选择 `BlackHole 2ch/16ch/64ch`（建议先用 2ch）。
   - 刷新页面并允许麦克风权限。
   - 若使用 `audiometer_v0d0.html`，也可在 `devSel` 下拉框里直接选择 `BlackHole`。