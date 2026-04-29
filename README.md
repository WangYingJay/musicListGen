# musicListGen

`有品服务-歌单生成` 是一个桌面端歌单封面生图工作台。当前项目已按轻量桌面架构启动 MVP 骨架：

- `launcher/`：Electron 主进程、preload 与后端 sidecar 启动器
- `desktop/`：React 18 + TypeScript + Vite 渲染层
- `backend/`：FastAPI sidecar，提供异步任务提交、任务轮询、图片结果读取
- `data/`：本地 SQLite 与生成结果运行目录，默认不提交生成文件

## 开发启动

一键启动：

```bash
npm run start:app
```

macOS 可以直接双击根目录的 `启动.command`。

Windows 可以直接双击根目录的 `启动-windows.bat`。

脚本会自动处理：

- 创建 `.venv`
- 安装/更新 Python 后端依赖
- 安装 Node 前端依赖
- 从 `.env.example` 初始化 `.env`
- 启动 Electron 桌面壳、FastAPI 后端，以及 Vite 前端开发服务

桌面壳已切换为 Electron：

- 开发态由 Electron 主进程自动拉起 FastAPI 和 Vite
- 生产态从 `desktop/dist` 加载静态前端，并通过 preload 暴露本地桌面能力
- 打包前会先把 Python 后端编译成 sidecar 可执行文件，再交给 `electron-builder` 生成 macOS / Windows 安装包

注意：Electron 产物仍建议分别在 macOS 和 Windows 上构建，避免跨平台打包时的二进制差异问题。

手动首次安装依赖：

```bash
npm install
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

启动桌面端：

```bash
npm run dev
```

打包目录预览：

```bash
npm run package:dir
```

生成安装包：

```bash
npm run dist:mac
npm run dist:win
```

单独启动后端：

```bash
npm run backend:dev
```

## 环境变量

复制 `.env.example` 为 `.env` 后配置上游生图服务：

```bash
UPSTREAM_API_BASE=https://api.openai.com/v1
UPSTREAM_API_KEY=your_api_key
```

当 `UPSTREAM_API_KEY` 存在时，前端默认使用服务端 Key，不会在请求里附带本地 Key。
