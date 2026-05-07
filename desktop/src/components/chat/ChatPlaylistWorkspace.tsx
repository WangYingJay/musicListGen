import { type CSSProperties, useEffect, useMemo, useRef, useState } from "react";

import { getBackendOrigin } from "../../api/client";
import { createEdit, createGeneration } from "../../api/image";
import { ComposerBar, type ComposerPanel, type ComposerUploadBucket } from "./ComposerBar";
import { InspirationShelf } from "./InspirationShelf";
import { SessionTimeline, type SessionTurnItem } from "./SessionTimeline";
import { visualPrompts } from "../../data/visualPrompts";
import { useConfigStore } from "../../stores/configStore";
import { useGalleryStore } from "../../stores/galleryStore";
import { usePlaylistDraftStore } from "../../stores/playlistDraftStore";
import { useTaskStore } from "../../stores/taskStore";
import { showToast } from "../../stores/toastStore";
import type { GenerateInput, ImageTask } from "../../types";
import { saveImageWithSystemDialog } from "../../utils/imageSaver";
import { appendOperationLog } from "../../utils/operationLog";
import { parsePlaylistPromptSummary } from "../../utils/playlistConversation";
import { buildPlaylistGenerateInput, buildPlaylistPrompt, cleanSongList } from "../../utils/playlistPrompt";
import { isPlaylistTask } from "../../utils/taskGrouping";

const defaultSongList = ["告五人 - 爱人错过", "陈绮贞 - 旅行的意义", "Deca Joins - 海浪"].join("\n");

interface UploadAsset {
  id: string;
  file: File;
  previewUrl: string;
}

interface ChatPlaylistWorkspaceProps {
  params: GenerateInput;
  onParamsChange: (params: GenerateInput) => void;
  resetSignal?: number;
}

export function ChatPlaylistWorkspace({ params, onParamsChange, resetSignal = 0 }: ChatPlaylistWorkspaceProps) {
  const addTaskFromResponse = useTaskStore((state) => state.addTaskFromResponse);
  const selectTask = useTaskStore((state) => state.selectTask);
  const tasksById = useTaskStore((state) => state.tasks);
  const selectedTaskId = useTaskStore((state) => state.selectedTaskId);
  const galleryItems = useGalleryStore((state) => state.items);
  const globalApiKey = useConfigStore((state) => state.apiKey);
  const temporaryApiKey = useConfigStore((state) => state.temporaryApiKey);
  const useServerKey = useConfigStore((state) => state.useServerKey);
  const capabilities = useConfigStore((state) => state.capabilities);
  const upstreamApiBase = useConfigStore((state) => state.upstreamApiBase);
  const models = useConfigStore((state) => state.models);
  const backendBaseUrl = useConfigStore((state) => state.backend.baseUrl);
  const visualPrompt = usePlaylistDraftStore((state) => state.visualPrompt);
  const artistName = usePlaylistDraftStore((state) => state.artistName);
  const songList = usePlaylistDraftStore((state) => state.songList);
  const mustHave = usePlaylistDraftStore((state) => state.mustHave);
  const avoid = usePlaylistDraftStore((state) => state.avoid);
  const temperature = usePlaylistDraftStore((state) => state.temperature);
  const setPromptPresetId = usePlaylistDraftStore((state) => state.setPromptPresetId);
  const setVisualPrompt = usePlaylistDraftStore((state) => state.setVisualPrompt);
  const setArtistName = usePlaylistDraftStore((state) => state.setArtistName);
  const setSongList = usePlaylistDraftStore((state) => state.setSongList);
  const setMustHave = usePlaylistDraftStore((state) => state.setMustHave);
  const setAvoid = usePlaylistDraftStore((state) => state.setAvoid);
  const setTemperature = usePlaylistDraftStore((state) => state.setTemperature);
  const resetDraft = usePlaylistDraftStore((state) => state.resetDraft);

  const [referenceImages, setReferenceImages] = useState<UploadAsset[]>([]);
  const [materialImages, setMaterialImages] = useState<UploadAsset[]>([]);
  const [avatarImages, setAvatarImages] = useState<UploadAsset[]>([]);
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activePanel, setActivePanel] = useState<ComposerPanel>(null);
  const [isFreshSession, setIsFreshSession] = useState(false);
  const objectUrls = useRef<string[]>([]);
  const hasHandledResetRef = useRef(false);

  const currentTask = currentTaskId ? tasksById[currentTaskId] : undefined;
  const selectedTask = selectedTaskId ? tasksById[selectedTaskId] : undefined;
  // 左侧会话列表是全局共享的，这里只接管歌单生成任务，避免图生图切回来时把上下文串掉。
  const selectedPlaylistTask = isPlaylistTask(selectedTask) ? selectedTask : undefined;
  const allUploadedFiles = [...avatarImages, ...referenceImages, ...materialImages].map((asset) => asset.file);
  const cleanedSongList = cleanSongList(songList);
  const canGenerate = Boolean(visualPrompt.trim() && cleanedSongList) && !isSubmitting && currentTask?.status !== "pending" && currentTask?.status !== "running";

  const timelineTasks = useMemo(
    () =>
      Object.values(tasksById)
        .filter((task) => isPlaylistTask(task))
        .sort((left, right) => left.created_at.localeCompare(right.created_at))
        .slice(-12),
    [tasksById]
  );

  const turnItems = useMemo<SessionTurnItem[]>(
    () =>
      timelineTasks.map((task) => {
        const summary = parsePlaylistPromptSummary(task.prompt);
        const paramsRecord = task.params as Record<string, unknown>;
        return {
          id: task.task_id,
          title: summary.title,
          shortPrompt: summary.shortPrompt,
          artistName: summary.artistName,
          songCount: summary.songCount,
          songPreview: summary.songPreview,
          status: task.status,
          message: task.message,
          imageUrl: task.imageUrl ? new URL(task.imageUrl, backendBaseUrl || getBackendOrigin()).toString() : undefined,
          model: String(paramsRecord.model || "gpt-image-2"),
          size: String(paramsRecord.size || "1024x1024"),
          createdAt: task.completed_at || task.created_at,
          active: selectedPlaylistTask?.task_id === task.task_id || (!selectedPlaylistTask && currentTask?.task_id === task.task_id)
        };
      }),
    [backendBaseUrl, currentTask?.task_id, selectedPlaylistTask?.task_id, timelineTasks]
  );
  const visibleTurnItems = isFreshSession ? [] : turnItems;

  const inspirationPresets = useMemo(
    () =>
      visualPrompts.slice(0, 4).map((preset) => ({
        id: preset.id,
        label: preset.label,
        description: parsePlaylistPromptSummary(`视觉风格提示（最高优先级）：${preset.text}`).shortPrompt
      })),
    []
  );

  const recentGalleryCards = useMemo(() => {
    return galleryItems
      .filter((item) => {
        const task = tasksById[item.taskId];
        return task ? isPlaylistTask(task) : false;
      })
      .slice(0, 3)
      .map((item) => {
        const task = tasksById[item.taskId];
        const summary = task ? parsePlaylistPromptSummary(task.prompt) : null;
        return {
          id: item.taskId,
          label: summary?.title || item.prompt || "最近作品",
          imageUrl: new URL(item.imageUrl, backendBaseUrl || getBackendOrigin()).toString()
        };
      });
  }, [backendBaseUrl, galleryItems, tasksById]);

  const focusTask = isFreshSession ? undefined : selectedPlaylistTask || currentTask || timelineTasks[timelineTasks.length - 1];
  const focusSummary = focusTask ? parsePlaylistPromptSummary(focusTask.prompt) : null;
  const focusDurationLabel = focusTask ? getTaskDurationLabel(focusTask, elapsedMs) : "刚刚开始";
  const heroStyle = focusTask?.imageUrl
    ? ({ ["--chat-hero-image" as string]: `url("${new URL(focusTask.imageUrl, backendBaseUrl || getBackendOrigin()).toString()}")` } as CSSProperties)
    : undefined;

  useEffect(() => {
    return () => {
      objectUrls.current.forEach((url) => URL.revokeObjectURL(url));
      objectUrls.current = [];
    };
  }, []);

  useEffect(() => {
    if (!startedAt) {
      return undefined;
    }
    const timer = window.setInterval(() => setElapsedMs(Date.now() - startedAt), 1000);
    return () => window.clearInterval(timer);
  }, [startedAt]);

  useEffect(() => {
    if (!currentTask) {
      return;
    }
    if (currentTask.status === "succeeded" || currentTask.status === "failed" || currentTask.status === "cancelled") {
      setStartedAt(null);
      if (currentTask.completed_at) {
        setElapsedMs(Math.max(0, Date.parse(currentTask.completed_at) - (startedAt || Date.now())));
      }
    }
  }, [currentTask, startedAt]);

  useEffect(() => {
    if (!hasHandledResetRef.current) {
      hasHandledResetRef.current = true;
      return;
    }
    setIsFreshSession(true);
    resetForm(false);
  }, [resetSignal]);

  useEffect(() => {
    if (selectedPlaylistTask) {
      setIsFreshSession(false);
    }
  }, [selectedPlaylistTask]);

  function buildCurrentPrompt() {
    return buildPlaylistPrompt({
      visualPrompt,
      artistName,
      songList,
      mustHave,
      avoid,
      temperature,
      imageSize: params.size,
      hasAvatar: avatarImages.length > 0,
      hasReferenceImages: referenceImages.length > 0,
      hasMaterialImages: materialImages.length > 0
    });
  }

  function applyPreset(presetId: string) {
    const preset = visualPrompts.find((item) => item.id === presetId) || visualPrompts[0];
    setPromptPresetId(preset.id);
    setVisualPrompt(preset.text);
    setActivePanel(null);
    appendOperationLog({ source: "创作台", message: `已切换灵感模板：${preset.label}` });
  }

  function resetForm(shouldNotify = true) {
    resetDraft();
    clearBucket("referenceImages");
    clearBucket("materialImages");
    clearBucket("avatarImages");
    setCurrentTaskId(null);
    setActivePanel(null);
    selectTask(null);
    appendOperationLog({ source: "创作台", message: "已重置当前创作草稿" });
    if (shouldNotify) {
      showToast({
        tone: "info",
        title: "表单已重置"
      });
    }
  }

  async function submitPlaylist() {
    if (!canGenerate) {
      showToast({
        tone: "warn",
        title: "还不能生成",
        description: "请先补充视觉描述和歌曲列表"
      });
      return;
    }

    const prompt = buildCurrentPrompt();
    setIsSubmitting(true);
    setElapsedMs(0);
    setStartedAt(Date.now());
    setActivePanel(null);
    setIsFreshSession(false);

    const input = buildPlaylistGenerateInput(params, prompt, params.size, params.quality);
    try {
      const hasImages = allUploadedFiles.length > 0;
      const canUseServerKey = Boolean(capabilities?.server_key_configured);
      const effectiveApiKey = temporaryApiKey.trim() || (canUseServerKey && useServerKey ? "" : globalApiKey.trim());
      const task = hasImages
        ? await createEdit(input, allUploadedFiles, effectiveApiKey, upstreamApiBase)
        : await createGeneration(input, effectiveApiKey, upstreamApiBase);
      addTaskFromResponse(task, input);
      setCurrentTaskId(task.task_id);
      appendOperationLog({
        source: "创作台",
        message: hasImages ? "已提交带素材的歌单任务" : "已提交纯提示词歌单任务",
        detail: { model: input.model, size: input.size, songCount: cleanedSongList.split("\n").length }
      });
      showToast({
        tone: "success",
        title: "歌单生成任务已提交",
        description: `${input.model} · ${input.size}`
      });
    } catch (error) {
      setStartedAt(null);
      appendOperationLog({
        source: "创作台",
        level: "error",
        message: "歌单生成任务提交失败",
        detail: error instanceof Error ? error.message : String(error)
      });
      showToast({
        tone: "error",
        title: "歌单生成任务提交失败",
        description: error instanceof Error ? error.message : String(error)
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  function addImages(files: FileList | File[], bucket: ComposerUploadBucket) {
    const images = Array.from(files).filter((file) => file.type.startsWith("image/"));
    if (!images.length) {
      showToast({
        tone: "warn",
        title: "没有检测到可用图片素材"
      });
      return;
    }

    const assets = images.map((file) => {
      const previewUrl = URL.createObjectURL(file);
      objectUrls.current.push(previewUrl);
      return { id: `${file.name}-${file.size}-${createId()}`, file, previewUrl };
    });

    if (bucket === "avatarImages") {
      avatarImages.forEach((asset) => URL.revokeObjectURL(asset.previewUrl));
      setAvatarImages(assets.slice(0, 1));
    } else if (bucket === "referenceImages") {
      setReferenceImages((previous) => [...previous, ...assets]);
    } else {
      setMaterialImages((previous) => [...previous, ...assets]);
    }
  }

  function clearBucket(bucket: ComposerUploadBucket) {
    const setter = bucket === "referenceImages" ? setReferenceImages : bucket === "materialImages" ? setMaterialImages : setAvatarImages;
    const current = bucket === "referenceImages" ? referenceImages : bucket === "materialImages" ? materialImages : avatarImages;
    current.forEach((asset) => URL.revokeObjectURL(asset.previewUrl));
    setter([]);
  }

  function removeAsset(bucket: ComposerUploadBucket, id: string) {
    const update = (items: UploadAsset[]) => {
      const target = items.find((item) => item.id === id);
      if (target) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return items.filter((item) => item.id !== id);
    };
    if (bucket === "referenceImages") {
      setReferenceImages(update);
    }
    if (bucket === "materialImages") {
      setMaterialImages(update);
    }
    if (bucket === "avatarImages") {
      setAvatarImages(update);
    }
  }

  async function copyPromptDraft() {
    const prompt = buildCurrentPrompt();
    try {
      await navigator.clipboard.writeText(prompt);
      showToast({
        tone: "success",
        title: "已复制提示词草稿"
      });
    } catch (error) {
      showToast({
        tone: "error",
        title: "复制提示词失败",
        description: error instanceof Error ? error.message : String(error)
      });
    }
  }

  async function copyTaskPrompt(taskId: string) {
    const task = tasksById[taskId];
    if (!task?.prompt) {
      return;
    }
    try {
      await navigator.clipboard.writeText(task.prompt);
      showToast({
        tone: "success",
        title: "已复制该轮提示词"
      });
    } catch (error) {
      showToast({
        tone: "error",
        title: "复制提示词失败",
        description: error instanceof Error ? error.message : String(error)
      });
    }
  }

  async function downloadTaskImage(taskId: string) {
    const task = tasksById[taskId];
    if (!task?.imageUrl) {
      return;
    }
    try {
      const result = await saveImageWithSystemDialog(task.imageUrl, `${taskId}.png`);
      if (result.saved) {
        showToast({
          tone: "success",
          title: "图片已保存",
          description: result.path || `${taskId}.png`
        });
      }
    } catch (error) {
      showToast({
        tone: "error",
        title: "保存图片失败",
        description: error instanceof Error ? error.message : String(error)
      });
    }
  }

  function reuseTask(taskId: string) {
    const task = tasksById[taskId];
    if (!task || !isPlaylistTask(task)) {
      return;
    }
    const summary = parsePlaylistPromptSummary(task.prompt);
    setVisualPrompt(summary.visualPrompt || visualPrompts[0].text);
    setArtistName(summary.artistName);
    setSongList(summary.songList || defaultSongList);
    setCurrentTaskId(task.task_id);
    setActivePanel(null);
    setIsFreshSession(false);
    selectTask(task.task_id);
    appendOperationLog({ source: "创作台", message: `已把会话 ${task.task_id} 带回当前草稿` });
    showToast({
      tone: "info",
      title: "已带入这轮结果继续优化"
    });
  }

  const composerHasBusyTask = currentTask?.status === "pending" || currentTask?.status === "running";

  return (
    <section className="chat-workspace">
      <div className="chat-workspace-shell">
        <header className="chat-hero" style={heroStyle}>
          <div className="chat-hero-copy">
            <p className="chat-hero-kicker">Playlist Cover Studio</p>
            <h1>{visibleTurnItems.length > 0 ? "继续把这轮封面往前推一版。" : "这次想做什么歌单封面？"}</h1>
            <span>
              {focusSummary
                ? `${focusSummary.title} · ${focusSummary.songCount} 首歌 · ${focusDurationLabel}`
                : "描述风格、歌单主题和画面气质，先把第一版海报跑出来。"}
            </span>
          </div>
        </header>

        {visibleTurnItems.length > 0 ? (
          <SessionTimeline
            turns={visibleTurnItems}
            onSelectTurn={(taskId) => selectTask(taskId)}
            onReuseTurn={reuseTask}
            onCopyPrompt={copyTaskPrompt}
            onDownloadImage={downloadTaskImage}
          />
        ) : null}

        <div className="chat-composer-dock">
          <ComposerBar
            visualPrompt={visualPrompt}
            songList={songList}
            artistName={artistName}
            mustHave={mustHave}
            avoid={avoid}
            temperature={temperature}
            params={params}
            models={models}
            activePanel={activePanel}
            avatarItems={avatarImages.map(toUploadChip)}
            referenceItems={referenceImages.map(toUploadChip)}
            materialItems={materialImages.map(toUploadChip)}
            isSubmitting={isSubmitting}
            isBusy={composerHasBusyTask}
            onPanelChange={setActivePanel}
            onVisualPromptChange={setVisualPrompt}
            onSongListChange={setSongList}
            onArtistNameChange={setArtistName}
            onMustHaveChange={setMustHave}
            onAvoidChange={setAvoid}
            onTemperatureChange={setTemperature}
            onParamsChange={onParamsChange}
            onAddImages={addImages}
            onRemoveAsset={removeAsset}
            onCopyPromptDraft={copyPromptDraft}
            onReset={() => resetForm(true)}
            onSubmit={() => {
              if (!canGenerate) {
                setActivePanel(cleanedSongList ? null : "songs");
              }
              void submitPlaylist();
            }}
          />
        </div>

        {visibleTurnItems.length === 0 ? (
          <InspirationShelf
            presets={inspirationPresets}
            galleryItems={recentGalleryCards}
            onSelectPreset={applyPreset}
            onReuseGalleryItem={reuseTask}
            onOpenUploads={() => setActivePanel("assets")}
          />
        ) : null}
      </div>
    </section>
  );
}

function toUploadChip(item: UploadAsset) {
  return {
    id: item.id,
    name: item.file.name,
    previewUrl: item.previewUrl
  };
}

function createId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function formatDuration(durationMs: number): string {
  if (!durationMs) {
    return "刚刚开始";
  }
  const totalSeconds = Math.max(1, Math.floor(durationMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0 ? `${minutes} 分 ${seconds} 秒` : `${seconds} 秒`;
}

function getTaskDurationLabel(task: ImageTask, liveDurationMs: number): string {
  if (task.started_at && task.completed_at) {
    return formatDuration(Math.max(0, Date.parse(task.completed_at) - Date.parse(task.started_at)));
  }
  if (task.status === "pending" || task.status === "running") {
    return formatDuration(liveDurationMs);
  }
  return task.status === "succeeded" ? "已完成" : task.status === "failed" ? "已结束" : "已停止";
}
