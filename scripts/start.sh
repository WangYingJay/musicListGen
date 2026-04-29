#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VENV_DIR="$ROOT_DIR/.venv"
REQUIREMENTS_STAMP="$VENV_DIR/.requirements.stamp"
NODE_STAMP="$ROOT_DIR/node_modules/.package.stamp"
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
printf "关闭 Electron 窗口会停止本地后端与前端开发服务。\n"

exec npm run dev
