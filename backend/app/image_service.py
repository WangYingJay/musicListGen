from __future__ import annotations

import base64
from contextlib import ExitStack
import json
from pathlib import Path
from typing import Any

import httpx

from .config import Settings
from .task_store import TaskStore, utc_now


async def run_generation_task(
    task_id: str,
    payload: dict[str, Any],
    store: TaskStore,
    settings: Settings,
    ephemeral_api_key: str | None = None,
    upstream_api_base_override: str | None = None,
) -> None:
    _append_backend_log(
        store,
        "info",
        f"任务 {task_id} 开始请求生图接口",
        {"task_id": task_id, "model": payload.get("model"), "size": payload.get("size"), "kind": "generations"},
    )
    store.update(
        task_id,
        status="running",
        progress=5,
        message="已提交到本地后端，正在请求上游生图服务",
        started_at=utc_now(),
    )
    try:
        result = await _call_generation(task_id, payload, store, settings, ephemeral_api_key, upstream_api_base_override)
        _append_backend_log(
            store,
            "info",
            f"任务 {task_id} 生图接口返回成功",
            {"task_id": task_id, "kind": "generations", "result_keys": list(result.keys())[:12]},
        )
        image_bytes = await _extract_first_image(result, settings)
        image_path = settings.results_dir / f"{task_id}.png"
        image_path.write_bytes(image_bytes)

        # MVP 先保存首张结果；多图返回后续可以扩展为 image_paths 列表而不改变轮询协议。
        public_result = {"data": [{"url": f"/api/tasks/{task_id}/image"}]}
        store.update(
            task_id,
            status="succeeded",
            progress=100,
            message="图片生成完成",
            result_json=json.dumps(public_result, ensure_ascii=False),
            image_path=str(image_path),
            completed_at=utc_now(),
        )
    except Exception as exc:
        _append_backend_log(store, "error", f"任务 {task_id} 生图接口失败", {"task_id": task_id, "error": str(exc)})
        store.update(
            task_id,
            status="failed",
            progress=100,
            message="图片生成失败",
            error=str(exc),
            completed_at=utc_now(),
        )


async def run_edit_task(
    task_id: str,
    payload: dict[str, Any],
    image_paths: list[Path],
    store: TaskStore,
    settings: Settings,
    ephemeral_api_key: str | None = None,
    upstream_api_base_override: str | None = None,
) -> None:
    _append_backend_log(
        store,
        "info",
        f"任务 {task_id} 开始请求编辑接口",
        {"task_id": task_id, "model": payload.get("model"), "size": payload.get("size"), "image_count": len(image_paths), "kind": "edits"},
    )
    store.update(
        task_id,
        status="running",
        progress=5,
        message="已接收参考图，正在请求上游编辑服务",
        started_at=utc_now(),
    )
    try:
        result = await _call_edit(task_id, payload, image_paths, store, settings, ephemeral_api_key, upstream_api_base_override)
        _append_backend_log(
            store,
            "info",
            f"任务 {task_id} 编辑接口返回成功",
            {"task_id": task_id, "kind": "edits", "result_keys": list(result.keys())[:12]},
        )
        image_bytes = await _extract_first_image(result, settings)
        result_path = settings.results_dir / f"{task_id}.png"
        result_path.write_bytes(image_bytes)

        public_result = {"data": [{"url": f"/api/tasks/{task_id}/image"}]}
        store.update(
            task_id,
            status="succeeded",
            progress=100,
            message="图片编辑完成",
            result_json=json.dumps(public_result, ensure_ascii=False),
            image_path=str(result_path),
            completed_at=utc_now(),
        )
    except Exception as exc:
        _append_backend_log(store, "error", f"任务 {task_id} 编辑接口失败", {"task_id": task_id, "error": str(exc)})
        store.update(
            task_id,
            status="failed",
            progress=100,
            message="图片编辑失败",
            error=str(exc),
            completed_at=utc_now(),
        )


async def _call_generation(
    task_id: str,
    payload: dict[str, Any],
    store: TaskStore,
    settings: Settings,
    ephemeral_api_key: str | None = None,
    upstream_api_base_override: str | None = None,
) -> dict[str, Any]:
    api_key = _resolve_api_key(settings, ephemeral_api_key)
    if not api_key:
        raise RuntimeError("未配置 UPSTREAM_API_KEY，无法请求上游生图服务")
    upstream_api_base = _resolve_upstream_api_base(settings, upstream_api_base_override)

    request_body = _compact_upstream_payload(payload)
    request_url = f"{upstream_api_base.rstrip('/')}/images/generations"
    _append_backend_log(store, "info", f"任务 {task_id} 发起上游生图请求", {"task_id": task_id, "url": request_url, "payload": request_body})
    async with httpx.AsyncClient(timeout=settings.request_timeout_seconds) as client:
        try:
            response = await client.post(
                request_url,
                headers={"Authorization": f"Bearer {api_key}"},
                json=request_body,
            )
        except httpx.HTTPError as exc:
            _append_backend_log(store, "error", f"任务 {task_id} 上游生图请求异常", {"task_id": task_id, "url": request_url, "error": repr(exc)})
            raise
        _append_backend_log(
            store,
            "info",
            f"任务 {task_id} 收到上游生图响应",
            {"task_id": task_id, "status_code": response.status_code, "content_type": response.headers.get("content-type", ""), "body_preview": _build_response_preview(response)},
        )
        return _parse_upstream_response(response)


async def _call_edit(
    task_id: str,
    payload: dict[str, Any],
    image_paths: list[Path],
    store: TaskStore,
    settings: Settings,
    ephemeral_api_key: str | None = None,
    upstream_api_base_override: str | None = None,
) -> dict[str, Any]:
    api_key = _resolve_api_key(settings, ephemeral_api_key)
    if not api_key:
        raise RuntimeError("未配置 UPSTREAM_API_KEY，无法请求上游图片编辑服务")
    upstream_api_base = _resolve_upstream_api_base(settings, upstream_api_base_override)

    fields = _compact_upstream_payload(payload)
    request_url = f"{upstream_api_base.rstrip('/')}/images/edits"
    _append_backend_log(
        store,
        "info",
        f"任务 {task_id} 发起上游编辑请求",
        {"task_id": task_id, "url": request_url, "fields": fields, "image_names": [image_path.name for image_path in image_paths]},
    )
    async with httpx.AsyncClient(timeout=settings.request_timeout_seconds) as client:
        with ExitStack() as stack:
            files = [
                (
                    "image",
                    (image_path.name, stack.enter_context(image_path.open("rb")), "application/octet-stream"),
                )
                for image_path in image_paths
            ]
            try:
                response = await client.post(
                    request_url,
                    headers={"Authorization": f"Bearer {api_key}"},
                    data=fields,
                    files=files,
                )
            except httpx.HTTPError as exc:
                _append_backend_log(store, "error", f"任务 {task_id} 上游编辑请求异常", {"task_id": task_id, "url": request_url, "error": repr(exc)})
                raise
        _append_backend_log(
            store,
            "info",
            f"任务 {task_id} 收到上游编辑响应",
            {"task_id": task_id, "status_code": response.status_code, "content_type": response.headers.get("content-type", ""), "body_preview": _build_response_preview(response)},
        )
        return _parse_upstream_response(response)


def _compact_upstream_payload(payload: dict[str, Any]) -> dict[str, Any]:
    # 只透传上游 OpenAI 兼容接口能理解的字段，避免把本地扩展参数误写进上游日志。
    # 某些兼容中转不接受 quality=auto，这里按 index.html 的成功路径做兼容：默认质量直接省略。
    allowed_keys = {"model", "prompt", "size", "n", "quality"}
    compacted = {key: value for key, value in payload.items() if key in allowed_keys and value is not None}
    if compacted.get("quality") == "auto":
        compacted.pop("quality", None)
    return compacted


def _resolve_api_key(settings: Settings, ephemeral_api_key: str | None = None) -> str:
    return (settings.upstream_api_key or ephemeral_api_key or "").strip()


def _resolve_upstream_api_base(settings: Settings, upstream_api_base_override: str | None = None) -> str:
    return (upstream_api_base_override or settings.upstream_api_base or "").strip().rstrip("/")


def _parse_upstream_response(response: httpx.Response) -> dict[str, Any]:
    content_type = response.headers.get("content-type", "")
    if response.status_code >= 400:
        try:
            data = response.json()
        except ValueError:
            data = {"message": response.text}
        if isinstance(data, dict):
            message = _format_upstream_error(data, response.status_code)
        else:
            message = ""
        raise RuntimeError(message or f"上游接口请求失败：{response.status_code}")

    if content_type.startswith("image/"):
        return {"data": [{"b64_json": base64.b64encode(response.content).decode("ascii")}]}

    try:
        data = response.json()
    except ValueError:
        raise RuntimeError("上游响应不是可识别的 JSON 或图片")

    if isinstance(data, dict) and data.get("error"):
        # 有些 OpenAI 兼容中转会用 HTTP 200 包一层业务错误，必须按失败处理，
        # 否则后续提取图片时只会报“缺少图片数据”，掩盖真正的上游失败原因。
        raise RuntimeError(_format_upstream_error(data))

    return data


def _format_upstream_error(data: dict[str, Any], http_status: int | None = None) -> str:
    error = data.get("error")
    if not isinstance(error, dict):
        message = str(data.get("message") or "上游接口返回错误").strip()
        return f"{message}（HTTP {http_status}）" if http_status else message

    message = str(error.get("message") or data.get("message") or "上游接口返回错误").strip()
    extra_parts = []
    status = http_status or error.get("status") or data.get("status")
    code = error.get("code") or data.get("code")
    generation_id = error.get("generation_id") or error.get("generationId") or data.get("generation_id") or data.get("generationId")
    if status:
        # HTTP 状态和业务状态都来自中转层，放进页面错误文案便于和上游控制台账单对齐。
        extra_parts.append(f"HTTP {status}")
    if code:
        extra_parts.append(str(code))
    if generation_id:
        extra_parts.append(f"generation_id {generation_id}")
    return f"{message}（{'，'.join(extra_parts)}）" if extra_parts else message


async def _extract_first_image(result: dict[str, Any], settings: Settings) -> bytes:
    nested = _find_image_field(result)
    if nested:
        kind, value = nested
        if kind == "base64":
            return base64.b64decode(_strip_data_url(value))
        async with httpx.AsyncClient(timeout=settings.request_timeout_seconds) as client:
            response = await client.get(value)
            response.raise_for_status()
            return response.content

    data = result.get("data")
    if not isinstance(data, list) or not data:
        raise RuntimeError("上游响应缺少图片数据")

    first = data[0]
    if not isinstance(first, dict):
        raise RuntimeError("上游图片数据格式不正确")

    if first.get("b64_json"):
        return base64.b64decode(first["b64_json"])

    if first.get("url"):
        async with httpx.AsyncClient(timeout=settings.request_timeout_seconds) as client:
            response = await client.get(first["url"])
            response.raise_for_status()
            return response.content

    raise RuntimeError("上游响应未包含 b64_json 或 url")


def _find_image_field(value: Any) -> tuple[str, str] | None:
    if isinstance(value, dict):
        for key, item in value.items():
            if isinstance(item, str):
                if key in {"b64_json", "base64", "result"} and len(item) > 200:
                    return ("base64", item)
                if key in {"url", "image_url"} and item.startswith(("http://", "https://")):
                    return ("url", item)
            nested = _find_image_field(item)
            if nested:
                return nested
    elif isinstance(value, list):
        for item in value:
            nested = _find_image_field(item)
            if nested:
                return nested
    return None


def _strip_data_url(value: str) -> str:
    return value.split(",", 1)[1] if "," in value else value


def _append_backend_log(store: TaskStore, level: str, message: str, detail: Any = None) -> None:
    store.append_backend_log(level, "后端", message, detail)


def _build_response_preview(response: httpx.Response, max_chars: int = 1200) -> str:
    body = response.text.strip()
    if not body:
        return ""
    return body[:max_chars]
