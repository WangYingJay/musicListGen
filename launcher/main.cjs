const { app, BrowserWindow, dialog, ipcMain } = require("electron");
const { spawn, spawnSync } = require("child_process");
const fs = require("fs");
const fsp = require("fs/promises");
const net = require("net");
const path = require("path");

const APP_ROOT = path.resolve(__dirname, "..");
const PRELOAD_PATH = path.join(__dirname, "preload.cjs");
const RENDERER_DEV_URL = "http://127.0.0.1:5173";
const RENDERER_DIST_INDEX = path.join(APP_ROOT, "desktop", "dist", "index.html");
const WINDOW_ICON = path.join(APP_ROOT, "logo.ico");
const STARTUP_LOG_PATH = path.join(APP_ROOT, "data", "startup.log");
const DEFAULT_BACKEND_PORT = Number(process.env.MUSIC_LIST_GEN_BACKEND_PORT || 8765);
const BACKEND_HOST = "127.0.0.1";
const isDev = process.argv.includes("--dev") || !app.isPackaged;
const shouldDisableHardwareAcceleration = process.env.MUSIC_LIST_GEN_DISABLE_GPU === "1";
const shouldOpenDevTools = process.env.MUSIC_LIST_GEN_OPEN_DEVTOOLS === "1";
const parentPid = process.ppid;

let mainWindow = null;
let backendProcess = null;
let frontendProcess = null;
let isShuttingDown = false;
let restartPromise = null;
let backendState = {
  status: "starting",
  baseUrl: "",
  port: null,
  message: "Electron 正在启动本地后端"
};

if (shouldDisableHardwareAcceleration) {
  // 只有在 GPU 驱动兼容性确实有问题时才降级到软件渲染，默认保留硬件加速。
  app.disableHardwareAcceleration();
}

app.whenReady().then(bootstrap).catch(handleBootstrapError);
process.on("uncaughtException", handleBootstrapError);
process.on("unhandledRejection", handleBootstrapError);

app.on("before-quit", (event) => {
  if (!isShuttingDown) {
    event.preventDefault();
    void shutdownAndExit(0);
  }
});

app.on("window-all-closed", () => {
  void shutdownAndExit(0);
});

process.on("SIGINT", () => {
  void shutdownAndExit(0);
});

process.on("SIGTERM", () => {
  void shutdownAndExit(0);
});

async function bootstrap() {
  registerIpcHandlers();
  startParentWatchdog();
  if (isDev) {
    await ensureFrontendDevServer();
  }
  await startBackend();
  await createMainWindow();
}

async function createMainWindow() {
  const windowOptions = {
    width: 1440,
    height: 900,
    minWidth: 1280,
    minHeight: 760,
    backgroundColor: "#0a0a0f",
    title: "有品服务-歌单生成",
    webPreferences: {
      preload: PRELOAD_PATH,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  };

  if (fs.existsSync(WINDOW_ICON) && process.platform !== "darwin") {
    windowOptions.icon = WINDOW_ICON;
  }

  mainWindow = new BrowserWindow(windowOptions);
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));

  if (isDev) {
    await mainWindow.loadURL(RENDERER_DEV_URL);
    if (shouldOpenDevTools) {
      mainWindow.webContents.openDevTools({ mode: "detach" });
    }
    return;
  }

  await mainWindow.loadFile(RENDERER_DIST_INDEX);
}

function registerIpcHandlers() {
  ipcMain.handle("desktop:get-backend-state", async () => backendState);
  ipcMain.handle("desktop:restart-backend", async () => restartBackend());
  ipcMain.handle("desktop:save-image", async (_event, input) => saveImageFromBackend(input));
}

async function restartBackend() {
  if (!restartPromise) {
    restartPromise = (async () => {
      await stopManagedProcess(backendProcess);
      backendProcess = null;
      await startBackend();
      return backendState;
    })().finally(() => {
      restartPromise = null;
    });
  }
  return restartPromise;
}

async function ensureFrontendDevServer() {
  if (frontendProcess && frontendProcess.exitCode === null) {
    return;
  }

  const frontendLaunch = resolveNpmScriptLaunch(["run", "frontend:dev"]);
  frontendProcess = spawn(frontendLaunch.command, frontendLaunch.args, {
    cwd: APP_ROOT,
    stdio: "inherit",
    detached: process.platform !== "win32"
  });

  frontendProcess.once("exit", (code, signal) => {
    if (isShuttingDown) {
      return;
    }
    console.error(formatExitMessage("前端开发服务已退出", code, signal));
  });

  await waitForChildStartup(frontendProcess, waitForHttp(`${RENDERER_DEV_URL}/`, "Vite 前端服务"), "Vite 前端服务");
}

async function startBackend() {
  const port = await findAvailablePort(DEFAULT_BACKEND_PORT);
  const baseUrl = `http://${BACKEND_HOST}:${port}`;
  const runtimeCwd = await resolveBackendRuntimeCwd();
  const { command, args } = resolveBackendLaunch(port);
  const stdio = isDev ? "inherit" : "ignore";

  updateBackendState({
    status: "starting",
    baseUrl,
    port,
    message: "Electron 正在启动本地后端"
  });

  backendProcess = spawn(command, args, {
    cwd: runtimeCwd,
    env: {
      ...process.env,
      MUSIC_LIST_GEN_BACKEND_PORT: String(port),
      PYTHONIOENCODING: "utf-8"
    },
    stdio,
    detached: process.platform !== "win32",
    windowsHide: true
  });

  const currentProcess = backendProcess;
  currentProcess.once("exit", (code, signal) => {
    if (backendProcess?.pid !== currentProcess.pid) {
      return;
    }
    backendProcess = null;
    updateBackendState({
      status: "offline",
      baseUrl,
      port,
      message: formatExitMessage("本地后端已退出", code, signal)
    });
  });

  await waitForChildStartup(currentProcess, waitForHttp(`${baseUrl}/health`, "后端健康检查"), "本地后端");
  updateBackendState({
    status: "online",
    baseUrl,
    port,
    message: "本地后端已就绪"
  });
}

async function resolveBackendRuntimeCwd() {
  if (isDev) {
    return APP_ROOT;
  }

  const runtimeDir = path.join(app.getPath("userData"), "runtime");
  await fsp.mkdir(runtimeDir, { recursive: true });
  return runtimeDir;
}

function resolveBackendLaunch(port) {
  if (!app.isPackaged) {
    const venvPython = process.platform === "win32"
      ? path.join(APP_ROOT, ".venv", "Scripts", "python.exe")
      : path.join(APP_ROOT, ".venv", "bin", "python");

    if (fs.existsSync(venvPython)) {
      return {
        command: venvPython,
        args: ["-m", "uvicorn", "backend.app.main:app", "--host", BACKEND_HOST, "--port", String(port)]
      };
    }

    if (process.platform === "win32") {
      return {
        command: "py",
        args: ["-3", "-m", "uvicorn", "backend.app.main:app", "--host", BACKEND_HOST, "--port", String(port)]
      };
    }

    return {
      command: "python3",
      args: ["-m", "uvicorn", "backend.app.main:app", "--host", BACKEND_HOST, "--port", String(port)]
    };
  }

  const executableName = process.platform === "win32" ? "music-list-gen-backend.exe" : "music-list-gen-backend";
  const packagedExecutable = path.join(process.resourcesPath, "backend", executableName);
  if (!fs.existsSync(packagedExecutable)) {
    throw new Error(`未找到打包后的后端程序：${packagedExecutable}`);
  }

  return {
    command: packagedExecutable,
    args: []
  };
}

function updateBackendState(nextState) {
  backendState = nextState;
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("desktop:backend-state-changed", backendState);
  }
}

async function saveImageFromBackend(input) {
  const rawUrl = String(input?.url || "").trim();
  if (!rawUrl) {
    return { saved: false };
  }

  const baseUrl = backendState.baseUrl || `http://${BACKEND_HOST}:${DEFAULT_BACKEND_PORT}`;
  const resolvedUrl = new URL(rawUrl, baseUrl).toString();
  const defaultName = sanitizeFileName(input?.defaultName || path.basename(new URL(resolvedUrl).pathname) || "playlist-cover.png");
  const defaultPath = path.join(app.getPath("pictures"), defaultName);
  const saveResult = await dialog.showSaveDialog(mainWindow || undefined, {
    defaultPath,
    filters: [
      { name: "PNG 图片", extensions: ["png"] },
      { name: "全部文件", extensions: ["*"] }
    ]
  });

  if (saveResult.canceled || !saveResult.filePath) {
    return { saved: false, cancelled: true };
  }

  const response = await fetch(resolvedUrl);
  if (!response.ok) {
    throw new Error(`下载图片失败：${response.status} ${response.statusText}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  await fsp.writeFile(saveResult.filePath, buffer);
  return { saved: true, path: saveResult.filePath };
}

async function shutdownAndExit(code) {
  if (isShuttingDown) {
    return;
  }
  isShuttingDown = true;

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.destroy();
  }

  await stopManagedProcess(backendProcess);
  await stopManagedProcess(frontendProcess);
  backendProcess = null;
  frontendProcess = null;
  app.exit(code);
}

async function stopManagedProcess(child) {
  if (!child || child.exitCode !== null) {
    return;
  }

  if (process.platform === "win32") {
    spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], {
      stdio: "ignore",
      windowsHide: true
    });
    return;
  }

  try {
    process.kill(-child.pid, "SIGTERM");
  } catch {
    return;
  }

  await waitForExit(child, 3_000);
  if (child.exitCode === null) {
    try {
      process.kill(-child.pid, "SIGKILL");
    } catch {
      return;
    }
    await waitForExit(child, 1_500);
  }
}

async function waitForExit(child, timeoutMs) {
  if (child.exitCode !== null) {
    return;
  }

  await Promise.race([
    new Promise((resolve) => child.once("exit", resolve)),
    new Promise((resolve) => setTimeout(resolve, timeoutMs))
  ]);
}

async function waitForHttp(url, label, timeoutMs = 45_000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url, { method: "GET" });
      if (response.status < 500) {
        return;
      }
    } catch {
      // 服务还没起来时会连续失败，这里保持重试，不打断启动流程。
    }
    await sleep(350);
  }
  throw new Error(`${label}超时：${url}`);
}

async function waitForChildStartup(child, readyPromise, label) {
  let errorHandler = null;
  let exitHandler = null;
  const startupFailure = new Promise((_, reject) => {
    errorHandler = (error) => {
      reject(error instanceof Error ? error : new Error(String(error)));
    };
    exitHandler = (code, signal) => {
      reject(new Error(formatExitMessage(`${label}启动失败`, code, signal)));
    };
    child.once("error", errorHandler);
    child.once("exit", exitHandler);
  });

  try {
    await Promise.race([readyPromise, startupFailure]);
  } finally {
    if (errorHandler) {
      child.removeListener("error", errorHandler);
    }
    if (exitHandler) {
      child.removeListener("exit", exitHandler);
    }
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function findAvailablePort(preferredPort) {
  try {
    return await tryListen(preferredPort);
  } catch {
    return tryListen(0);
  }
}

function tryListen(port) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.once("error", reject);
    server.listen(port, BACKEND_HOST, () => {
      const address = server.address();
      server.close((closeError) => {
        if (closeError) {
          reject(closeError);
          return;
        }
        resolve(address.port);
      });
    });
  });
}

function resolveNpmCommand() {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}

function resolveNpmScriptLaunch(args) {
  if (process.platform !== "win32") {
    return { command: "npm", args };
  }

  // Windows 下直接 spawn npm.cmd 在部分 Node/Electron 组合里会触发 EINVAL。
  // 通过 cmd.exe 启动 npm 脚本，保持和用户双击 bat 的执行环境一致。
  return { command: "cmd.exe", args: ["/d", "/s", "/c", "npm", ...args] };
}

function sanitizeFileName(fileName) {
  return String(fileName).replace(/[\\/:*?"<>|]+/g, "-");
}

function formatExitMessage(prefix, code, signal) {
  if (typeof code === "number") {
    return `${prefix}（exit code ${code}）`;
  }
  if (signal) {
    return `${prefix}（signal ${signal}）`;
  }
  return prefix;
}

function startParentWatchdog() {
  if (process.platform === "win32") {
    return;
  }

    // Windows 通过 npm/electron.cmd 启动时，父进程可能只是短生命周期包装器；
    // 继续监听会误判父进程退出，导致桌面窗口刚启动就被主动关闭。
    return;
  if (parentPid <= 1) {
    return;
  }

  const timer = setInterval(() => {
    try {
      process.kill(parentPid, 0);
    } catch {
      clearInterval(timer);
      void shutdownAndExit(0);
    }
  }, 1_000);
  timer.unref();
}

function handleBootstrapError(error) {
  const message = error instanceof Error ? error.message : String(error);
  writeStartupLog(error);
  console.error(error);
  dialog.showErrorBox("Electron 启动失败", message);
  void shutdownAndExit(1);
}

function writeStartupLog(error) {
  try {
    fs.mkdirSync(path.dirname(STARTUP_LOG_PATH), { recursive: true });
    const detail = error instanceof Error ? (error.stack || error.message) : String(error);
    // Windows double-click startup can close the console before the error is visible.
    fs.appendFileSync(STARTUP_LOG_PATH, `[${new Date().toISOString()}]\n${detail}\n\n`, "utf8");
  } catch {
    // Logging must not introduce a second startup failure.
  }
}
