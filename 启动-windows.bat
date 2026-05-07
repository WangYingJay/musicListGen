@echo off
setlocal
chcp 65001 >nul

cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo 启动失败：未找到 node，请先安装 Node.js
  pause
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo 启动失败：未找到 npm，请先安装 Node.js
  pause
  exit /b 1
)

where py >nul 2>nul
if errorlevel 1 (
  where python >nul 2>nul
  if errorlevel 1 (
    echo 启动失败：未找到 Python，请先安装 Python 3
    pause
    exit /b 1
  )
  set PYTHON_CMD=python
) else (
  set PYTHON_CMD=py -3
)

if not exist ".env" (
  if exist ".env.example" copy ".env.example" ".env" >nul
)

if not exist ".venv\\Scripts\\python.exe" (
  echo 创建 Python 虚拟环境
  %PYTHON_CMD% -m venv .venv
  if errorlevel 1 (
    echo 启动失败：创建虚拟环境失败
    pause
    exit /b 1
  )
)

echo 安装/更新后端依赖
".venv\\Scripts\\python.exe" -m pip install -r requirements.txt
if errorlevel 1 (
  echo 启动失败：后端依赖安装失败
  pause
  exit /b 1
)

echo 安装/更新前端依赖
call npm install
if errorlevel 1 (
  echo 启动失败：前端依赖安装失败
  pause
  exit /b 1
)

echo 启动桌面应用
call npm run dev
pause
