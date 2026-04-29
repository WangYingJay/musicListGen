const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const ROOT_DIR = path.resolve(__dirname, "..");
const ENTRY_FILE = path.join(ROOT_DIR, "launcher", "backend-entry.py");
const DIST_DIR = path.join(ROOT_DIR, "dist", "backend");
const WORK_DIR = path.join(ROOT_DIR, "build", "pyinstaller", "work");
const SPEC_DIR = path.join(ROOT_DIR, "build", "pyinstaller", "spec");

ensureDir(DIST_DIR);
ensureDir(WORK_DIR);
ensureDir(SPEC_DIR);

const { command, argsPrefix } = resolvePython();
const pyinstallerArgs = [
  ...argsPrefix,
  "-m",
  "PyInstaller",
  "--noconfirm",
  "--clean",
  "--onefile",
  "--name",
  "music-list-gen-backend",
  "--distpath",
  DIST_DIR,
  "--workpath",
  WORK_DIR,
  "--specpath",
  SPEC_DIR,
  "--paths",
  ROOT_DIR,
  "--collect-all",
  "fastapi",
  "--collect-all",
  "starlette",
  "--collect-all",
  "uvicorn",
  "--collect-all",
  "pydantic",
  "--collect-all",
  "pydantic_settings",
  "--collect-all",
  "httpx",
  ENTRY_FILE
];

const result = spawnSync(command, pyinstallerArgs, {
  cwd: ROOT_DIR,
  stdio: "inherit",
  env: {
    ...process.env,
    PYTHONIOENCODING: "utf-8"
  }
});

if (typeof result.status === "number") {
  process.exit(result.status);
}

if (result.error) {
  console.error(result.error);
}
process.exit(1);

function resolvePython() {
  const venvPython = process.platform === "win32"
    ? path.join(ROOT_DIR, ".venv", "Scripts", "python.exe")
    : path.join(ROOT_DIR, ".venv", "bin", "python");

  if (fs.existsSync(venvPython)) {
    return { command: venvPython, argsPrefix: [] };
  }

  if (process.platform === "win32") {
    return { command: "py", argsPrefix: ["-3"] };
  }

  return { command: "python3", argsPrefix: [] };
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}
