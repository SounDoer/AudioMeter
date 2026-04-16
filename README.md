# AudioMeter

在浏览器里做**实时音频监测**的小工具：峰值表、**LUFS 响度**（含 Momentary / Short-term / Integrated、LRA、True Peak 等）、**频谱**与**矢量示波器**。纯前端实现，无需后端。

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
![Stack](https://img.shields.io/badge/stack-React%20%2B%20Vite-lightgrey)

## 功能概览

| 区域 | 说明 |
|------|------|
| **Peak** | 立体声峰值 / 表头 |
| **Loudness** | BS.1770-4 风格链路（AudioWorklet），历史曲线可交互查看 |
| **Spectrum** | 分析器频谱 |
| **Vectorscope** | 李萨如 / 相关表读数 |
| **Settings** | EBU R128 / Streaming 目标、明主题与暗主题、布局重置 |

音频在本地通过 Web Audio 处理；**不会**上传到任何服务器。

## 环境要求

- 支持 **Web Audio**、**AudioWorklet**、`getUserMedia` 的现代浏览器（桌面 Chrome / Edge / Firefox 等）。
- **麦克风权限**：首次点击 **START** 时浏览器会请求访问音频输入。
- **必须通过 HTTP(S) 提供页面**：本地开发可用 `localhost`；公网部署请使用 **HTTPS**（多数浏览器在非安全上下文中会限制麦克风）。

## 快速开始

克隆或下载本仓库后，进入 `react-ui` 启动开发服务器：

```bash
cd react-ui
npm install
npm run dev
```

浏览器访问终端输出中的本地地址（通常为 `http://localhost:5173/`）。

## 仓库结构

```
index.html               # 根入口（重定向到 react-ui）
react-ui/
  src/
    App.jsx              # 主界面与交互
    uiPreferences.js     # UI 配置与偏好
    scales.js            # 刻度与量程配置
  public/worklets/
    loudness-meter.js    # 响度测量 AudioWorklet
```

## 测「系统正在播放的声音」

浏览器只能采集**输入设备**（麦克风、线路输入、或虚拟声卡呈现的「输入」）。若要监测**系统回放**，需要把系统输出路由到这类输入，常见做法：

- **Windows**：例如 [VB-Audio Virtual Cable](https://vb-audio.com/Cable/VirtualCables.htm)，将播放设备指到 CABLE Input，并把 CABLE Output 设为系统默认**录音**设备（或确保浏览器使用的默认输入是该虚拟设备）。
- **macOS**：例如 [BlackHole](https://existential.audio/blackhole/)，在「声音 → 输入」中选择对应设备。

当前版本使用系统**默认输入设备**；更换设备后请刷新页面并重新授权。

## 隐私与对外部署注意

- **数据处理**：音频仅在用户本机处理与显示，无自有后端接口。
- **第三方资源**：页面通过 Google Fonts 加载字体；若部署环境对出站请求敏感，可改为自托管字体并修改 `react-ui/src/index.css`。
- **本地存储**：界面偏好会保存在 `localStorage`，不涉及服务端。
- **错误信息**：启动失败时界面仅显示简要说明；详细错误可在开发者工具控制台查看（便于排障，避免向普通访问者暴露堆栈路径）。

## 参与与许可

欢迎 Issue / PR。本项目采用 [MIT License](LICENSE)：可自由使用、修改和再分发，但需保留原始版权声明与许可全文。

若你希望著作权人显示为组织名或其他名字，可自行修改 `LICENSE` 首行 `Copyright`。
