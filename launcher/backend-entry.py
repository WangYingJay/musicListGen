from __future__ import annotations

import os

import uvicorn

from backend.app.main import app


def main() -> None:
    # Electron 会在启动时动态分配端口，这里只读取它传入的环境变量，
    # 保持开发态和打包态的后端启动逻辑一致。
    port = int(os.environ.get("MUSIC_LIST_GEN_BACKEND_PORT", "8765"))
    uvicorn.run(app, host="127.0.0.1", port=port)


if __name__ == "__main__":
    main()
