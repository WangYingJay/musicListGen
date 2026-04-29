# musicListGen

`有品服务-歌单生成` 是一个桌面端歌单封面生图工作台。当前项目已按轻量桌面架构启动 MVP 骨架：

- `launcher/`：pywebview 原生窗口启动器
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
- 启动 FastAPI 后端、Vite 前端，并用 pywebview 打开原生桌面窗口

轻量桌面壳采用 pywebview：

- macOS 使用系统 WebKit
- Windows 使用系统 Edge WebView2
- 不再下载 Electron 二进制

Windows 如果提示缺少 WebView2 Runtime，请安装 Microsoft Edge WebView2 Runtime 后再启动。

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
