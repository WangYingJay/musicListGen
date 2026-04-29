from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field


TaskStatus = Literal["pending", "running", "succeeded", "failed", "cancelled"]
TaskKind = Literal["generations", "edits"]


class GenerateImageRequest(BaseModel):
    model: str = "gpt-image-2"
    prompt: str
    negative_prompt: Optional[str] = None
    size: str = "1024x1024"
    n: int = Field(default=1, ge=1, le=4)
    quality: Literal["auto", "standard", "high"] = "auto"
    steps: Optional[int] = Field(default=None, ge=1, le=80)
    cfg_scale: Optional[float] = Field(default=None, ge=1, le=20)
    seed: Optional[int] = None


class ImageTaskResponse(BaseModel):
    id: str
    task_id: str
    kind: TaskKind
    status: TaskStatus
    progress: int = 0
    message: str
    error: Optional[str] = None
    result: Optional[Dict[str, Any]] = None
    request: Optional[Dict[str, Any]] = None
    gallery_hidden: bool = False
    poll_url: str
    created_at: str
    started_at: Optional[str] = None
    completed_at: Optional[str] = None


class ImageTaskListResponse(BaseModel):
    data: List[ImageTaskResponse]


class GalleryVisibilityRequest(BaseModel):
    hidden: bool = True


class CapabilitiesResponse(BaseModel):
    server_key_configured: bool
    supports_generations: bool = True
    supports_edits: bool = True
    supports_cancel: bool = False
    supports_progress: bool = True
    supports_moderation: bool = False
    supports_models: bool = False
    default_api_base: str


class ModelItem(BaseModel):
    id: str
    name: str
    supports_edit: bool = True
    sizes: List[str]


class ModelListResponse(BaseModel):
    data: List[ModelItem]


class BackendLogItem(BaseModel):
    id: int
    created_at: str
    level: Literal["info", "warn", "error"]
    source: str
    message: str
    detail: Optional[str] = None


class BackendLogListResponse(BaseModel):
    data: List[BackendLogItem]
