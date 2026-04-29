from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Optional

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    app_name: str = "有品服务-歌单生成"
    upstream_api_base: str = "https://api.openai.com/v1"
    upstream_api_key: Optional[str] = None
    task_db_path: Path = Path("data/tasks.sqlite3")
    results_dir: Path = Path("data/results")
    uploads_dir: Path = Path("data/uploads")
    request_timeout_seconds: float = 620.0


@lru_cache
def get_settings() -> Settings:
    settings = Settings()
    settings.results_dir.mkdir(parents=True, exist_ok=True)
    settings.uploads_dir.mkdir(parents=True, exist_ok=True)
    settings.task_db_path.parent.mkdir(parents=True, exist_ok=True)
    return settings
