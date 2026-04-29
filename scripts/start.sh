#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VENV_DIR="$ROOT_DIR/.venv"
REQUIREMENTS_STAMP="$VENV_DIR/.requirements.stamp"
NODE_STAMP="$ROOT_DIR/node_modules/.package.stamp"
APP_PORTS=(8765 5173)
APP_PID=""
CLEANING_UP=0

cd "$ROOT_DIR"

say_step() {
  printf "\n\033[1;36m%s\033[0m\n" "$1"
}

fail() {
  printf "\n\033[1;31m启动失败：%s\033[0m\n" "$1" >&2
  exit 1
}

command_exists() {
  command -v "$1" >/dev/null 2>&1
}

cleanup_ports() {
  local port pid cmd
  command_exists lsof || return 0
  for port in "${APP_PORTS[@]}"; do
    while IFS= read -r pid; do
      [ -n "$pid" ] || continue
      cmd="$(ps -p "$pid" -o command= 2>/dev/null || true)"
      case "$cmd" in
        *"$ROOT_DIR"*|*"backend.app.main:app"*|*"vite --host 127.0.0.1 --port 5173"*)
          kill "$pid" 2>/dev/null || true
          sleep 0.5
          kill -9 "$pid" 2>/dev/null || true
          ;;
      esac
    done < <(lsof -nP -iTCP:"$port" -sTCP:LISTEN -t 2>/dev/null || true)
  done
}

cleanup_on_exit() {
  if [ "$CLEANING_UP" -eq 1 ]; then
    return
  fi
  CLEANING_UP=1

  if [ -n "${APP_PID:-}" ]; then
    kill "$APP_PID" 2>/dev/null || true
    for _ in 1 2 3 4 5; do
      kill -0 "$APP_PID" 2>/dev/null || break
      sleep 0.2
    done
    kill -0 "$APP_PID" 2>/dev/null && kill -9 "$APP_PID" 2>/dev/null || true
    wait "$APP_PID" 2>/dev/null || true
  fi
  cleanup_ports
}

trap cleanup_on_exit EXIT HUP INT TERM

say_step "检查本机运行环境"
command_exists node || fail "未找到 node，请先安装 Node.js"
command_exists npm || fail "未找到 npm，请先安装 Node.js"
command_exists python3 || fail "未找到 python3，请先安装 Python 3"

if [ ! -f "$ROOT_DIR/.env" ] && [ -f "$ROOT_DIR/.env.example" ]; then
  say_step "初始化 .env"
  cp "$ROOT_DIR/.env.example" "$ROOT_DIR/.env"
  printf "已从 .env.example 创建 .env；如需真实生图，请填写 UPSTREAM_API_KEY。\n"
fi

if [ ! -d "$VENV_DIR" ]; then
  say_step "创建 Python 虚拟环境"
  python3 -m venv "$VENV_DIR"
fi

say_step "激活 Python 虚拟环境"
# shellcheck disable=SC1091
source "$VENV_DIR/bin/activate"

if [ ! -f "$REQUIREMENTS_STAMP" ] || [ "$ROOT_DIR/requirements.txt" -nt "$REQUIREMENTS_STAMP" ]; then
  say_step "安装/更新后端依赖"
  python -m pip install --upgrade pip
  python -m pip install -r "$ROOT_DIR/requirements.txt"
  touch "$REQUIREMENTS_STAMP"
fi

if [ ! -d "$ROOT_DIR/node_modules" ] \
  || [ ! -d "$ROOT_DIR/desktop/node_modules" ] \
  || [ ! -f "$NODE_STAMP" ] \
  || [ "$ROOT_DIR/package.json" -nt "$NODE_STAMP" ] \
  || [ "$ROOT_DIR/desktop/package.json" -nt "$NODE_STAMP" ]; then
  say_step "安装/更新前端依赖"
  npm install
  touch "$NODE_STAMP"
fi

say_step "启动桌面应用"
printf "关闭应用窗口会停止开发服务。\n"

# pywebview 会打开系统原生 WebView，启动器负责拉起 FastAPI 和 Vite。
python "$ROOT_DIR/launcher/app.py" &
APP_PID=$!
wait "$APP_PID"
