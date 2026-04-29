from __future__ import annotations

import atexit
import os
import re
import signal
import shutil
import socket
import subprocess
import sys
import threading
import time
from pathlib import Path
from urllib.request import urlopen

import webview


ROOT_DIR = Path(__file__).resolve().parents[1]
BACKEND_PORT = int(os.environ.get("MUSIC_LIST_GEN_BACKEND_PORT", "8765"))
FRONTEND_PORT = int(os.environ.get("MUSIC_LIST_GEN_FRONTEND_PORT", "5173"))
BACKEND_URL = f"http://127.0.0.1:{BACKEND_PORT}"
FRONTEND_URL = f"http://127.0.0.1:{FRONTEND_PORT}"

processes: list[subprocess.Popen] = []
cleanup_started = False
parent_pid = os.getppid()


def main() -> None:
    os.chdir(ROOT_DIR)
    npm = resolve_command("npm")

    cleanup_stale_project_ports()
    backend = start_process(
        [sys.executable, "-m", "uvicorn", "backend.app.main:app", "--host", "127.0.0.1", "--port", str(BACKEND_PORT)],
        "后端",
    )
    frontend = start_process([npm, "run", "dev", "--workspace", "desktop"], "前端")

    wait_for_http(f"{BACKEND_URL}/health", "后端健康检查")
    wait_for_port(FRONTEND_PORT, "前端开发服务")

    if backend is not None and backend.poll() is not None:
        raise RuntimeError("后端进程启动后已退出")
    if frontend is not None and frontend.poll() is not None:
        raise RuntimeError("前端进程启动后已退出")

    start_parent_watchdog()
    window = webview.create_window(
        "有品服务-歌单生成",
        FRONTEND_URL,
        width=1440,
        height=900,
        min_size=(1280, 760),
        background_color="#0a0a0f",
    )
    webview.start(debug=True)
    cleanup()


def start_parent_watchdog() -> None:
    # 双击 .command / .bat 时，终端或命令窗口是启动器父进程；如果它被用户直接关掉，
    # pywebview 可能还在 GUI 事件循环里，所以额外用守护线程发现父进程消失并清理端口。
    if parent_pid <= 1:
        return

    thread = threading.Thread(target=watch_parent_process, daemon=True)
    thread.start()


def watch_parent_process() -> None:
    while True:
        time.sleep(1)
        if os.getppid() == 1 or not pid_is_alive(parent_pid):
            cleanup()
            os._exit(0)


def start_process(command: list[str], label: str) -> subprocess.Popen:
    print(f"启动{label}：{' '.join(command)}")
    kwargs = {"cwd": ROOT_DIR}
    if os.name == "nt":
        kwargs["creationflags"] = subprocess.CREATE_NEW_PROCESS_GROUP
    else:
        kwargs["start_new_session"] = True
    process = subprocess.Popen(command, **kwargs)
    processes.append(process)
    return process


def resolve_command(name: str) -> str:
    resolved = shutil.which(name)
    if resolved:
        return resolved
    raise RuntimeError(f"未找到命令：{name}")


def wait_for_http(url: str, label: str, timeout_seconds: float = 45.0) -> None:
    started_at = time.time()
    while time.time() - started_at < timeout_seconds:
        try:
            with urlopen(url, timeout=1.0) as response:
                if response.status < 500:
                    return
        except Exception:
            pass
        time.sleep(0.35)
    raise RuntimeError(f"{label}超时：{url}")


def is_http_ready(url: str) -> bool:
    try:
        with urlopen(url, timeout=0.5) as response:
            return response.status < 500
    except Exception:
        return False


def wait_for_port(port: int, label: str, timeout_seconds: float = 45.0) -> None:
    started_at = time.time()
    while time.time() - started_at < timeout_seconds:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            sock.settimeout(0.5)
            if sock.connect_ex(("127.0.0.1", port)) == 0:
                return
        time.sleep(0.35)
    raise RuntimeError(f"{label}超时：127.0.0.1:{port}")


def is_port_ready(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.settimeout(0.5)
        return sock.connect_ex(("127.0.0.1", port)) == 0


def cleanup() -> None:
    global cleanup_started
    if cleanup_started:
        return
    cleanup_started = True

    for process in reversed(processes):
        terminate_process_tree(process, force=False)

    deadline = time.time() + 5
    for process in reversed(processes):
        if process.poll() is None:
            remaining = max(0.1, deadline - time.time())
            try:
                process.wait(timeout=remaining)
            except subprocess.TimeoutExpired:
                terminate_process_tree(process, force=True)


def terminate_process_tree(process: subprocess.Popen, force: bool) -> None:
    if process.poll() is not None:
        return

    if os.name == "nt":
        args = ["taskkill", "/PID", str(process.pid), "/T"]
        if force:
            args.append("/F")
        subprocess.run(args, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=False)
        return

    try:
        os.killpg(process.pid, signal.SIGKILL if force else signal.SIGTERM)
    except ProcessLookupError:
        return


def cleanup_stale_project_ports() -> None:
    for port in (BACKEND_PORT, FRONTEND_PORT):
        for pid in listening_pids(port):
            command = process_command(pid)
            if is_project_process(command):
                print(f"清理残留端口 {port}：PID {pid}")
                kill_pid_tree(pid)
            else:
                raise RuntimeError(f"端口 {port} 已被其他进程占用：PID {pid} {command}")
    wait_until_ports_free((BACKEND_PORT, FRONTEND_PORT))


def listening_pids(port: int) -> set[int]:
    if os.name == "nt":
        return listening_pids_windows(port)
    return listening_pids_unix(port)


def listening_pids_unix(port: int) -> set[int]:
    result = subprocess.run(
        ["lsof", "-nP", f"-iTCP:{port}", "-sTCP:LISTEN", "-t"],
        stdout=subprocess.PIPE,
        stderr=subprocess.DEVNULL,
        text=True,
        check=False,
    )
    return {int(line) for line in result.stdout.splitlines() if line.strip().isdigit()}


def listening_pids_windows(port: int) -> set[int]:
    result = subprocess.run(
        ["netstat", "-ano", "-p", "tcp"],
        stdout=subprocess.PIPE,
        stderr=subprocess.DEVNULL,
        text=True,
        check=False,
    )
    pids: set[int] = set()
    pattern = re.compile(rf"^\s*TCP\s+\S+:{port}\s+\S+\s+LISTENING\s+(\d+)\s*$", re.IGNORECASE)
    for line in result.stdout.splitlines():
        match = pattern.match(line)
        if match:
            pids.add(int(match.group(1)))
    return pids


def process_command(pid: int) -> str:
    if os.name == "nt":
        script = f"(Get-CimInstance Win32_Process -Filter \"ProcessId={pid}\").CommandLine"
        result = subprocess.run(
            ["powershell", "-NoProfile", "-Command", script],
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            text=True,
            check=False,
        )
        return result.stdout.strip()

    result = subprocess.run(
        ["ps", "-p", str(pid), "-o", "command="],
        stdout=subprocess.PIPE,
        stderr=subprocess.DEVNULL,
        text=True,
        check=False,
    )
    return result.stdout.strip()


def is_project_process(command: str) -> bool:
    normalized_root = str(ROOT_DIR).replace("\\", "/")
    normalized_command = command.replace("\\", "/")
    return (
        "backend.app.main:app" in normalized_command
        or ("vite" in normalized_command and str(FRONTEND_PORT) in normalized_command)
        or normalized_root in normalized_command
    )


def kill_pid_tree(pid: int) -> None:
    if os.name == "nt":
        subprocess.run(["taskkill", "/PID", str(pid), "/T", "/F"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=False)
        return

    try:
        os.kill(pid, signal.SIGTERM)
    except ProcessLookupError:
        return
    time.sleep(0.5)
    if pid_is_alive(pid):
        try:
            os.kill(pid, signal.SIGKILL)
        except ProcessLookupError:
            return


def pid_is_alive(pid: int) -> bool:
    if os.name == "nt":
        result = subprocess.run(
            ["tasklist", "/FI", f"PID eq {pid}", "/NH"],
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            text=True,
            check=False,
        )
        return str(pid) in result.stdout

    try:
        os.kill(pid, 0)
        return True
    except ProcessLookupError:
        return False


def wait_until_ports_free(ports: tuple[int, ...]) -> None:
    started_at = time.time()
    while time.time() - started_at < 5:
        if all(not listening_pids(port) for port in ports):
            return
        time.sleep(0.2)


def handle_signal(signum: int, _frame: object) -> None:
    cleanup()
    raise SystemExit(128 + signum)


atexit.register(cleanup)
signal.signal(signal.SIGINT, handle_signal)
signal.signal(signal.SIGTERM, handle_signal)
if hasattr(signal, "SIGHUP"):
    signal.signal(signal.SIGHUP, handle_signal)


if __name__ == "__main__":
    main()
