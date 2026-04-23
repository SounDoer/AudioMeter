# 参与贡献

感谢你对 AudioMeter 的兴趣。以下为本地开发与 CI 约定；更完整的架构决策见 [`docs/architecture.md`](docs/architecture.md)。

## 环境

- **Node.js**：20 LTS（与 `package.json` 的 `engines` 一致）
- **Rust**：stable（与 `src-tauri/Cargo.toml` 的 `rust-version` 一致）

## 常用命令

```bash
npm ci
npm run lint
npm test
npm run build
```

桌面端（Tauri）：

```bash
npm run desktop
```

Rust（在 `src-tauri` 目录下）：

```bash
cd src-tauri
cargo fmt --all -- --check
cargo clippy --all-targets -- -D warnings
cargo test
```

根目录一键检查 **前端 + 版本号 + Rust 格式/静态检查/测试**：

```bash
npm run check
```

## 版本号

发布或 bump 版本时，请同时修改（并保持三者一致）：

- 根目录 `package.json` 的 `version`
- `src-tauri/Cargo.toml` 中 `[package]` 的 `version`
- `src-tauri/tauri.conf.json` 的 `version`

`npm run version:check` 会校验上述三处一致；CI 中也会运行。若改了 `Cargo.toml` 依赖，请在 `src-tauri` 下执行 `cargo check` 并视情况提交 `Cargo.lock`。

## CI 说明

- **Pull request / push 到 `main`**：见 [`.github/workflows/ci.yml`](.github/workflows/ci.yml)（前端 + Ubuntu 上 Rust；Windows 上 Rust `fmt` / `clippy` / `test`）。
- **Windows 安装包**：打 `v*` 标签触发 [`.github/workflows/release.yml`](.github/workflows/release.yml)。

## 依赖更新

仓库已启用 [Dependabot](.github/dependabot.yml)（npm 与 cargo，每周）。合并前请在本地跑一遍 `npm run check`。

## 行尾与编码

仓库使用 **LF**（见 [`.editorconfig`](.editorconfig) 与 [`.gitattributes`](.gitattributes)）。在 Windows 上若 Git 仍提示 CRLF，可执行 `git add --renormalize .` 一次性规范化。
