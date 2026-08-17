# DSH Studio

A native-window desktop client for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness), wrapping the official dsh Web UI. Works out of the box.

> The DeepSeek logo is a trademark of DeepSeek. This app uses it as a wrapper around the open-source DeepSeek Harness project; please follow DeepSeek brand guidelines for public distribution.

## Features

- ✅ Out-of-the-box: embeds `dsh web` using Electron's built-in Node (packaged builds need **no pre-installed Node/pnpm**)
- ✅ Port auto-discovery + health check, then loads the official UI
- ✅ System tray: close-to-tray, double-click restore, right-click menu
- ✅ Task-completion system notifications (subscribes to the dsh host event stream)
- ✅ Crash auto-restart with backoff; child process reaped on quit
- ✅ Window state memory (position/size/maximized → `$DSH_HOME/config.json`)
- ✅ Model selection via the official Settings → Models page (keys stored in `~/.dsh/.env`)
- ✅ Plugin marketplace & manager (recommended plugins, one-click install)
- ✅ Built-in file explorer (VS Code-style tree + right-side preview + editing)
- ✅ Built-in appearance section: wallpaper upload/gradients/solid + visibility/blur, button radius, accent colors, border styles, window Acrylic/Mica
- ✅ Branded whale-logo splash following system light/dark
- ✅ Auto-update via electron-updater (packaged builds, GitHub Releases)
- ✅ Official whale icon (window/tray/notifications/installer)

## Install & Run

### Installer (recommended)

Download `DSH-Studio-Setup-<version>.exe` from [Releases](https://github.com/YOUR_GITHUB_OWNER/dsh-studio/releases) and install.

### From source (development)

```bash
npm install
npm run dev
npm run build
npm run dist
```

## Architecture & Data

See [README.md](README.md) (Chinese) for details. Desktop state lives under `$DSH_HOME/config.json` and `~/.dsh/desktop/`; official dsh data stays untouched under `~/.dsh`.

## License

MIT
