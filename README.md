# DSH Studio

DeepSeek Harness 桌面客户端 —— 以原生窗口封装 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 的 Web UI，开箱即用。界面简体中文（官方 UI 跟随浏览器语言）。

> DeepSeek 图形为深度求索公司商标，本应用作为其开源项目 DeepSeek Harness 的封装使用；正式分发请遵循 DeepSeek 品牌指南。

## 功能

- ✅ **开箱即用**：内置 `dsh web`（复用 Electron 内置 Node，打包版**无需预装 Node/pnpm**）
- ✅ **端口自适应 + 健康检查**：服务就绪后自动加载官方 UI
- ✅ **系统托盘**：关闭最小化到托盘；双击恢复；右键菜单（显示主界面/新建任务/打开设置/打开工作区/退出）
- ✅ **任务完成系统通知**：任务完成且窗口在后台时发系统通知（订阅 dsh 宿主事件流）
- ✅ **崩溃自动重启**（指数退避）+ 退出自动回收子进程
- ✅ **窗口状态记忆**：位置/大小/最大化持久化到 `$DSH_HOME/config.json`
- ✅ **模型自主选择**：复用官方 设置 → 模型（API Key 写入 `~/.dsh/.env`）
- ✅ **插件市场/管理器**（推荐安装）：浏览/搜索/一键安装社区插件，启用/停用
- ✅ **文件资源管理器**（内置）：VS Code 风格文件树 + 右侧预览编辑 + 毛玻璃界面
- ✅ **个性化外观**（内置，设置页独立区块）：壁纸上传/渐变/纯色 + 可见度/模糊、按键圆角、强调色、边框样式、窗口毛玻璃（Acrylic）/云母（Mica）
- ✅ **启动体验**：官方鲸鱼 Logo 启动页，跟随系统深浅色
- ✅ **自动更新**：electron-updater（打包版，GitHub Releases）
- ✅ 官方鲸鱼图标（窗口/托盘/通知/安装包）

## 安装与运行

### 安装包（推荐）

下载 [Releases](https://github.com/YOUR_GITHUB_OWNER/dsh-studio/releases) 中的 `DSH-Studio-Setup-<version>.exe`，双击安装。安装后桌面/开始菜单出现「DSH Studio」快捷方式（鲸鱼图标）。

### 源码运行（开发）

```bash
npm install          # 首次会下载 Electron 二进制
npm run dev          # 开发模式（主进程改动自动重启）
npm run build        # 构建
npm run dist         # 打包（当前平台）
npm run icons        # 重新生成图标（仅 Windows 开发机需要）
```

## 架构

```
Electron 主进程 (Node.js)
├─ DshService      spawn [Electron 内置 Node] dsh web（--expose-internals）
│                  → 端口解析 + 健康检查 → 就绪加载官方 UI
├─ PluginService   封装 dsh plugin add/remove（推荐插件一键安装）
├─ 内置插件         dsh-studio-appearance / dsh-file-explorer（应用 node_modules
│                   + 官方扁平回退目录链接，零 pnpm 安装）
├─ preload/IPC      window.dshStudio 桥接（壁纸选择、窗口材质、外观配置）
└─ 其他             托盘/窗口状态/任务通知/自动更新/壁纸 HTTP 服务/运行时桥
```

## 数据目录

- 官方数据（profiles / 凭据 `.env` / 会话）：`~/.dsh`（透传，不干预）
- 桌面壳数据：`$DSH_HOME/config.json`（窗口状态/外观/标记）+ `~/.dsh/desktop/`（壁纸/运行时桥）

## 许可

MIT

## 相关文档

- [用户手册](docs/用户手册.md)
- [模型配置指南](docs/模型配置指南.md) / [插件管理指南](docs/插件管理指南.md) / [文件树指南](docs/文件树指南.md) / [外观设置指南](docs/外观设置指南.md)
