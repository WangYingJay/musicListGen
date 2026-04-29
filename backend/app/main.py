from pathlib import Path
from typing import List, Optional
from uuid import uuid4

from fastapi import BackgroundTasks, FastAPI, File, Form, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from .config import get_settings
from .image_service import run_edit_task, run_generation_task
from .schemas import BackendLogItem, BackendLogListResponse, CapabilitiesResponse, GenerateImageRequest, ImageTaskResponse, ModelItem, ModelListResponse
from .task_store import TaskStore

settings = get_settings()
store = TaskStore(settings.task_db_path)

app = FastAPI(title=settings.app_name)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:5173", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup() -> None:
    store.init()
    store.append_backend_log(
        "info",
        "后端",
        "本地后端已启动",
        {"upstream_api_base": settings.upstream_api_base, "task_db_path": str(settings.task_db_path)},
    )


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/capabilities", response_model=CapabilitiesResponse)
def capabilities() -> CapabilitiesResponse:
    return CapabilitiesResponse(
        server_key_configured=bool(settings.upstream_api_key),
        default_api_base=settings.upstream_api_base,
    )


@app.get("/api/models", response_model=ModelListResponse)
def models() -> ModelListResponse:
    # 先提供本地默认列表，未来可改成从上游或配置文件动态读取。
    return ModelListResponse(
        data=[
            ModelItem(
                id="gpt-image-2",
                name="GPT Image 2",
                supports_edit=True,
                sizes=["1024x1024", "1024x1536", "1536x1024"],
            )
        ]
    )


@app.get("/api/logs", response_model=BackendLogListResponse)
def backend_logs(after_id: int = 0, limit: int = 100) -> BackendLogListResponse:
    entries = [BackendLogItem(**item) for item in store.list_backend_logs(after_id=after_id, limit=limit)]
    return BackendLogListResponse(data=entries)


@app.post("/api/images/generations", response_model=ImageTaskResponse)
async def create_generation(
    payload: GenerateImageRequest,
    background_tasks: BackgroundTasks,
    authorization: Optional[str] = Header(default=None),
    x_upstream_api_base: Optional[str] = Header(default=None),
) -> ImageTaskResponse:
    task_id = uuid4().hex
    task = store.create(task_id, "generations", payload.model_dump())
    background_tasks.add_task(
        run_generation_task,
        task_id,
        payload.model_dump(),
        store,
        settings,
        _extract_bearer_token(authorization),
        _extract_upstream_api_base(x_upstream_api_base),
    )
    return _to_response(task)


@app.post("/api/images/edits", response_model=ImageTaskResponse)
async def create_edit(
    background_tasks: BackgroundTasks,
    image: List[UploadFile] = File(...),
    model: str = Form("gpt-image-2"),
    prompt: str = Form(...),
    size: str = Form("1024x1024"),
    quality: str = Form("auto"),
    authorization: Optional[str] = Header(default=None),
    x_upstream_api_base: Optional[str] = Header(default=None),
) -> ImageTaskResponse:
    task_id = uuid4().hex
    task_upload_dir = settings.uploads_dir / task_id
    task_upload_dir.mkdir(parents=True, exist_ok=True)
    upload_paths = []
    for index, upload in enumerate(image):
        upload_path = task_upload_dir / f"{index}-{Path(upload.filename or 'reference.png').name}"
        upload_path.write_bytes(await upload.read())
        upload_paths.append(upload_path)

    # 参考图只保存本地路径，临时 Key 不进入任务库，避免密钥被持久化。
    payload = {"model": model, "prompt": prompt, "size": size, "quality": quality, "image_paths": [str(path) for path in upload_paths]}
    task = store.create(task_id, "edits", payload)
    background_tasks.add_task(
        run_edit_task,
        task_id,
        payload,
        upload_paths,
        store,
        settings,
        _extract_bearer_token(authorization),
        _extract_upstream_api_base(x_upstream_api_base),
    )
    return _to_response(task)


@app.get("/api/tasks/{task_id}", response_model=ImageTaskResponse)
def get_task(task_id: str) -> ImageTaskResponse:
    task = store.get(task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    return _to_response(task)


@app.get("/api/tasks/{task_id}/image")
def get_task_image(task_id: str) -> FileResponse:
    task = store.get(task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    image_path = task.get("image_path")
    if not image_path or not Path(image_path).exists():
        raise HTTPException(status_code=404, detail="Image not found")
    return FileResponse(image_path, media_type="image/png")


def _to_response(task: dict) -> ImageTaskResponse:
    return ImageTaskResponse(
        id=task["id"],
        task_id=task["id"],
        kind=task["kind"],
        status=task["status"],
        progress=task["progress"],
        message=task["message"],
        error=task["error"],
        result=task["result"],
        poll_url=f"/api/tasks/{task['id']}",
        created_at=task["created_at"],
        started_at=task["started_at"],
        completed_at=task["completed_at"],
    )


def _extract_bearer_token(authorization: Optional[str]) -> Optional[str]:
    value = (authorization or "").strip()
    if value.lower().startswith("bearer "):
        return value[7:].strip()
    return value or None


def _extract_upstream_api_base(x_upstream_api_base: Optional[str]) -> Optional[str]:
    value = (x_upstream_api_base or "").strip()
    return value or None
