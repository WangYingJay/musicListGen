import { Bot, Copy, Dice5, Download, Frame, ImagePlus, Loader2, Music2, Palette, RefreshCw, Save, Sparkles, UploadCloud, X } from "lucide-react";
import { type CSSProperties, ChangeEvent, DragEvent, useEffect, useMemo, useRef, useState } from "react";

import { getBackendOrigin } from "../../api/client";
import { createEdit, createGeneration } from "../../api/image";
import { SelectMenu } from "../common/SelectMenu";
import { visualPrompts } from "../../data/visualPrompts";
import { useConfigStore } from "../../stores/configStore";
import { useTaskStore } from "../../stores/taskStore";
import type { GenerateInput, ImageTask } from "../../types";
import { appendOperationLog } from "../../utils/operationLog";
import { buildPlaylistGenerateInput, buildPlaylistPrompt, cleanSongList } from "../../utils/playlistPrompt";

const CONFIG_KEY = "playlist-image-generator-config-v4";
const LAST_RESULT_KEY = "playlist-image-generator-last-result-v4";
const defaultSongList = ["告五人 - 爱人错过", "陈绮贞 - 旅行的意义", "Deca Joins - 海浪"].join("\n");
const fallbackModelOptions = [{ id: "gpt-image-2", name: "GPT Image 2", supports_edit: true, sizes: ["1024x1024", "1024x1536", "1536x1024"] }];
const qualityOptions: Array<{ value: GenerateInput["quality"]; label: string }> = [
  { value: "auto", label: "自动质量" },
  { value: "standard", label: "标准质量" },
  { value: "high", label: "高质量" }
];

type UploadBucket = "referenceImages" | "materialImages" | "avatarImages";

interface UploadAsset {
  id: string;
  file: File;
  previewUrl: string;
}

interface PlaylistWorkflowProps {
  params: GenerateInput;
  onParamsChange: (params: GenerateInput) => void;
}

export function PlaylistWorkflow({ params, onParamsChange }: PlaylistWorkflowProps) {
  const addTaskFromResponse = useTaskStore((state) => state.addTaskFromResponse);
  const tasksById = useTaskStore((state) => state.tasks);
  const selectedTaskId = useTaskStore((state) => state.selectedTaskId);
  const globalApiKey = useConfigStore((state) => state.apiKey);
  const temporaryApiKey = useConfigStore((state) => state.temporaryApiKey);
  const useServerKey = useConfigStore((state) => state.useServerKey);
  const capabilities = useConfigStore((state) => state.capabilities);
  const upstreamApiBase = useConfigStore((state) => state.upstreamApiBase);
  const models = useConfigStore((state) => state.models);

  const [promptPresetId, setPromptPresetId] = useState(visualPrompts[0].id);
  const [visualPrompt, setVisualPrompt] = useState(visualPrompts[0].text);
  const [artistName, setArtistName] = useState("");
  const [songList, setSongList] = useState(defaultSongList);
  const [mustHave, setMustHave] = useState("");
  const [avoid, setAvoid] = useState("");
  const [temperature, setTemperature] = useState(0.8);
  const [referenceImages, setReferenceImages] = useState<UploadAsset[]>([]);
  const [materialImages, setMaterialImages] = useState<UploadAsset[]>([]);
  const [avatarImages, setAvatarImages] = useState<UploadAsset[]>([]);
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);
  const [finalPrompt, setFinalPrompt] = useState("");
  const [restoredResult, setRestoredResult] = useState<{ imageUrl: string; finalPrompt: string; createdAt: string } | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const objectUrls = useRef<string[]>([]);

  const currentTask = currentTaskId ? tasksById[currentTaskId] : undefined;
  const selectedTask = selectedTaskId ? tasksById[selectedTaskId] : undefined;
  const allUploadedFiles = [...avatarImages, ...referenceImages, ...materialImages].map((asset) => asset.file);
  const cleanedSongList = cleanSongList(songList);
  const activePresetLabel = visualPrompts.find((preset) => preset.id === promptPresetId)?.label || visualPrompts[0].label;
  const modelOptions = models.length > 0 ? models : fallbackModelOptions;
  const activeModel = modelOptions.find((model) => model.id === params.model) || modelOptions[0];

  const latestImageTask = useMemo(() => {
    if (selectedTask?.imageUrl) {
      return selectedTask;
    }
    if (currentTask?.imageUrl) {
      return currentTask;
    }
    return Object.values(tasksById)
      .filter((task) => task.imageUrl)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
  }, [currentTask, selectedTask, tasksById]);

  const displayedTask = selectedTask || currentTask || latestImageTask;
  const displayedImageUrl = latestImageTask?.imageUrl || restoredResult?.imageUrl || "";
  const displayedImageHref = displayedImageUrl ? new URL(displayedImageUrl, getBackendOrigin()).toString() : "";
  const displayedPrompt = selectedTask?.prompt || finalPrompt || restoredResult?.finalPrompt || "";
  const previewTitle = selectedTask ? "已选历史结果" : artistName || "未命名艺名";
  const songCount = cleanedSongList ? cleanedSongList.split("\n").length : 0;
  const canGenerate = Boolean(visualPrompt.trim() && cleanedSongList && !isSubmitting && currentTask?.status !== "pending" && currentTask?.status !== "running");

  useEffect(() => {
    const rawConfig = localStorage.getItem(CONFIG_KEY);
    if (rawConfig) {
      try {
        const config = JSON.parse(rawConfig);
        setPromptPresetId(config.promptPresetId || visualPrompts[0].id);
        setVisualPrompt(config.visualPrompt || visualPrompts[0].text);
        setArtistName(config.artistName || "");
        setSongList(config.songList || defaultSongList);
        setMustHave(config.mustHave || "");
        setAvoid(config.avoid || "");
        setTemperature(Number(config.temperature ?? 0.8));
      } catch {
        appendOperationLog({ source: "创作台", level: "warn", message: "读取本地歌单配置失败" });
      }
    }

    try {
      const rawResult = localStorage.getItem(LAST_RESULT_KEY);
      if (rawResult) {
        const parsedResult = JSON.parse(rawResult);
        if (parsedResult?.imageUrl && parsedResult?.finalPrompt) {
          setRestoredResult(parsedResult);
          setFinalPrompt(parsedResult.finalPrompt);
        }
      }
    } catch {
      appendOperationLog({ source: "创作台", level: "warn", message: "读取上次生成结果失败" });
    }

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
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      if (currentTask?.status !== "pending" && currentTask?.status !== "running") {
        return;
      }
      event.preventDefault();
      event.returnValue = "";
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [currentTask?.status]);

  useEffect(() => {
    if (!currentTask) {
      return;
    }
    if (currentTask.status === "succeeded" || currentTask.status === "failed" || currentTask.status === "cancelled") {
      setStartedAt(null);
      if (currentTask.completed_at) {
        setElapsedMs(Math.max(0, Date.parse(currentTask.completed_at) - (startedAt || Date.now())));
      }
      if (currentTask.status === "succeeded" && currentTask.imageUrl && finalPrompt) {
        const result = { imageUrl: currentTask.imageUrl, finalPrompt, createdAt: currentTask.completed_at || new Date().toISOString() };
        setRestoredResult(result);
        localStorage.setItem(LAST_RESULT_KEY, JSON.stringify(result));
      }
    }
  }, [currentTask, finalPrompt, startedAt]);

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

  function saveConfig() {
    const config = {
      promptPresetId,
      visualPrompt,
      artistName,
      songList,
      mustHave,
      avoid,
      temperature
    };
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
    appendOperationLog({
      source: "创作台",
      message: "已保存歌单创作配置",
      detail: { promptPresetId, songCount, hasUploads: allUploadedFiles.length > 0 }
    });
  }

  function applyPreset(presetId: string) {
    const preset = visualPrompts.find((item) => item.id === presetId) || visualPrompts[0];
    setPromptPresetId(preset.id);
    setVisualPrompt(preset.text);
    appendOperationLog({
      source: "创作台",
      message: `已切换视觉模板：${preset.label}`
    });
  }

  function randomPreset() {
    const candidates = visualPrompts.filter((preset) => preset.id !== promptPresetId);
    const preset = candidates[Math.floor(Math.random() * candidates.length)] || visualPrompts[0];
    applyPreset(preset.id);
  }

  function resetForm() {
    applyPreset(visualPrompts[0].id);
    setArtistName("");
    setSongList(defaultSongList);
    setMustHave("");
    setAvoid("");
    setTemperature(0.8);
    clearBucket("referenceImages");
    clearBucket("materialImages");
    clearBucket("avatarImages");
    setFinalPrompt("");
    setRestoredResult(null);
    localStorage.removeItem(LAST_RESULT_KEY);
    setCurrentTaskId(null);
    appendOperationLog({ source: "创作台", message: "已重置歌单创作表单" });
  }

  async function submitPlaylist() {
    if (isSubmitting || currentTask?.status === "pending" || currentTask?.status === "running") {
      appendOperationLog({ source: "创作台", level: "warn", message: "当前已有任务在生成中" });
      return;
    }

    if (!visualPrompt.trim() || !cleanedSongList) {
      appendOperationLog({
        source: "创作台",
        level: "warn",
        message: "生成前校验失败",
        detail: "视觉提示词和歌曲列表必须填写"
      });
      return;
    }

    saveConfig();
    const prompt = buildCurrentPrompt();
    setFinalPrompt(prompt);
    setIsSubmitting(true);
    setElapsedMs(0);
    setStartedAt(Date.now());

    const input = buildPlaylistGenerateInput(params, prompt, params.size, params.quality);
    try {
      const hasImages = allUploadedFiles.length > 0;
      const canUseServerKey = Boolean(capabilities?.server_key_configured);
      const effectiveApiKey = temporaryApiKey.trim() || (canUseServerKey && useServerKey ? "" : globalApiKey.trim());
      appendOperationLog({
        source: "创作台",
        message: hasImages ? "开始提交带素材的歌单任务" : "开始提交纯提示词歌单任务",
        detail: { model: input.model, size: input.size, songCount, uploadCount: allUploadedFiles.length }
      });
      const task = hasImages
        ? await createEdit(input, allUploadedFiles, effectiveApiKey, upstreamApiBase)
        : await createGeneration(input, effectiveApiKey, upstreamApiBase);
      addTaskFromResponse(task, input);
      setCurrentTaskId(task.task_id);
    } catch (error) {
      setStartedAt(null);
      appendOperationLog({
        source: "创作台",
        level: "error",
        message: "歌单生成任务提交失败",
        detail: error instanceof Error ? error.message : String(error)
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  function addImages(files: FileList | File[], bucket: UploadBucket) {
    const images = Array.from(files).filter((file) => file.type.startsWith("image/"));
    if (!images.length) {
      appendOperationLog({ source: "创作台", level: "warn", message: "没有检测到可用图片素材" });
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

    appendOperationLog({
      source: "创作台",
      message: `已添加${renderBucketLabel(bucket)}`,
      detail: { count: assets.length }
    });
  }

  function clearBucket(bucket: UploadBucket) {
    const setter = bucket === "referenceImages" ? setReferenceImages : bucket === "materialImages" ? setMaterialImages : setAvatarImages;
    const current = bucket === "referenceImages" ? referenceImages : bucket === "materialImages" ? materialImages : avatarImages;
    current.forEach((asset) => URL.revokeObjectURL(asset.previewUrl));
    setter([]);
  }

  function removeAsset(bucket: UploadBucket, id: string) {
    const update = (items: UploadAsset[]) => {
      const target = items.find((item) => item.id === id);
      if (target) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return items.filter((item) => item.id !== id);
    };
    if (bucket === "referenceImages") setReferenceImages(update);
    if (bucket === "materialImages") setMaterialImages(update);
    if (bucket === "avatarImages") setAvatarImages(update);
    appendOperationLog({ source: "创作台", level: "warn", message: `已移除${renderBucketLabel(bucket)}` });
  }

  async function copyGeneratedPrompt() {
    const prompt = buildCurrentPrompt();
    await navigator.clipboard.writeText(prompt);
    appendOperationLog({ source: "创作台", message: "已复制最终提示词草案" });
  }

  async function copyPromptPreview() {
    if (!displayedPrompt) {
      return;
    }
    await navigator.clipboard.writeText(displayedPrompt);
    appendOperationLog({ source: "创作台", message: "已复制最终提示词结果" });
  }

  async function downloadCurrentImage() {
    if (!displayedImageUrl) {
      return;
    }
    downloadImage(displayedImageUrl, selectedTask ? "已选历史结果" : artistName, promptPresetId);
    appendOperationLog({ source: "创作台", message: "已下载当前封面结果" });
  }

  return (
    <section className="playlist-workflow editor-home">
      <div className="playlist-main editor-feed">
        <header className="workspace-head editor-feed-head">
          <div>
            <p className="eyebrow">Workspace</p>
            <h1>歌单封面创作台</h1>
            <p className="workspace-head-copy">主页面收拢为写提示词、整理歌曲、补素材、看结果四件事，像编辑器一样把注意力留在中间主舞台。</p>
          </div>
          <div className="workspace-head-stats">
            <span className="workflow-stat">模板 {activePresetLabel}</span>
            <span className="workflow-stat">歌曲 {songCount} 首</span>
            <span className="workflow-stat">素材 {allUploadedFiles.length} 张</span>
            <span className="workflow-stat">状态 {renderTaskStatus(displayedTask)}</span>
          </div>
        </header>

        <div className="editor-stage-grid">
          <section
            className="editor-preview-column"
            style={displayedImageHref ? ({ ["--result-image" as string]: `url("${displayedImageHref}")` } as CSSProperties) : undefined}
          >
            <div className={displayedImageHref ? "playlist-result-frame editor-result-frame" : "playlist-result-frame editor-result-frame empty"}>
              {displayedImageHref ? (
                <>
                  <img src={displayedImageHref} alt="生成的歌单图片" />
                  <div className="result-frame-overlay">
                    <span>{selectedTask ? "已选结果" : "最新封面"}</span>
                    <strong>{previewTitle}</strong>
                  </div>
                </>
              ) : (
                <div>
                  <Music2 size={40} />
                  <p>把提示词、歌曲和素材整理好之后，新的封面会优先出现在这里。</p>
                </div>
              )}
            </div>

            <div className="result-meta editor-stage-meta">
              <span>耗时：{formatDuration(elapsedMs)}</span>
              <span>歌曲：{songCount} 首</span>
              <span>素材：{allUploadedFiles.length} 张</span>
              <span>模型：{activeModel?.name || params.model}</span>
            </div>
          </section>

          <section className="editor-detail-column">
            <div className="workspace-block editor-detail-block">
              <div className="workspace-block-head">
                <div>
                  <p className="eyebrow">Result</p>
                  <h2>当前结果</h2>
                </div>
                <span className={`status-pill ${displayedTask?.status || "offline"}`}>{renderTaskStatus(displayedTask)}</span>
              </div>

              <div className="editor-detail-list">
                <span className="workflow-stat">模板 {activePresetLabel}</span>
                <span className="workflow-stat">尺寸 {params.size}</span>
                <span className="workflow-stat">质量 {params.quality}</span>
                <span className="workflow-stat">数量 {params.n}</span>
              </div>

              <p className="editor-result-message">{displayedTask?.message || "当前还没有任务输出，先在下方整理提示词和素材即可。"}</p>

              <div className="workflow-actions result-column-actions">
                <button type="button" className="ghost-button" onClick={saveConfig}>
                  <Save size={14} />
                  保存草稿
                </button>
                <button type="button" className="ghost-button" disabled={!displayedPrompt} onClick={() => void copyPromptPreview()}>
                  <Copy size={14} />
                  复制结果提示词
                </button>
                <button type="button" className="ghost-button" disabled={!displayedImageUrl} onClick={() => void downloadCurrentImage()}>
                  <Download size={14} />
                  下载图片
                </button>
              </div>
            </div>

            <section className="workspace-block prompt-preview-panel editor-detail-block">
              <div className="workspace-block-head">
                <div>
                  <p className="eyebrow">Prompt</p>
                  <h2>最终提示词</h2>
                </div>
              </div>
              <pre className="prompt-preview-box editor-prompt-preview">{displayedPrompt || "提交任务后，这里会显示最终送进模型的提示词。"}</pre>
            </section>
          </section>
        </div>
      </div>

      <section className="composer-shell">
        <div className="composer-core-grid composer-main-grid">
          <textarea
            className="composer-textarea composer-visual-input composer-main-textarea"
            value={visualPrompt}
            onChange={(event) => setVisualPrompt(event.target.value)}
            placeholder="图片提示词"
          />
          <textarea
            className="composer-textarea composer-song-input composer-main-textarea composer-song-priority"
            value={songList}
            onChange={(event) => setSongList(event.target.value)}
            placeholder="歌曲列表"
          />
        </div>

        <div className="composer-action-row composer-footer">
          <div className="composer-footer-left">
            <div className="composer-footer-group composer-footer-template-group">
              <button type="button" className="ghost-button composer-icon-button" title="随机模板" aria-label="随机模板" onClick={randomPreset}>
                <Dice5 size={12} />
              </button>
              <SelectMenu
                ariaLabel="视觉模板"
                value={promptPresetId}
                options={visualPrompts.map((preset) => ({ value: preset.id, label: preset.label }))}
                icon={<Palette size={12} />}
                triggerClassName="composer-select-trigger composer-template-trigger"
                menuClassName="composer-select-menu"
                onChange={applyPreset}
              />
            </div>
            <div className="composer-footer-group composer-footer-model-group">
              <SelectMenu
                ariaLabel="模型"
                value={params.model}
                options={modelOptions.map((model) => ({ value: model.id, label: model.name }))}
                icon={<Bot size={12} />}
                hideValue
                triggerClassName="composer-select-trigger"
                menuClassName="composer-select-menu"
                onChange={(value) => {
                  const nextModel = modelOptions.find((model) => model.id === value) || modelOptions[0];
                  const nextSize = nextModel.sizes.includes(params.size) ? params.size : nextModel.sizes[0];
                  onParamsChange({ ...params, model: value, size: nextSize });
                  appendOperationLog({ source: "创作台", message: `已切换模型为 ${value}` });
                }}
              />
              <SelectMenu
                ariaLabel="尺寸"
                value={params.size}
                options={activeModel.sizes.map((size) => ({ value: size, label: size }))}
                icon={<Frame size={12} />}
                hideValue
                triggerClassName="composer-select-trigger"
                menuClassName="composer-select-menu"
                onChange={(value) => {
                  onParamsChange({ ...params, size: value });
                  appendOperationLog({ source: "创作台", message: `已切换尺寸为 ${value}` });
                }}
              />
              <SelectMenu
                ariaLabel="质量"
                value={params.quality}
                options={qualityOptions}
                icon={<Sparkles size={12} />}
                hideValue
                triggerClassName="composer-select-trigger"
                menuClassName="composer-select-menu"
                onChange={(value) => {
                  onParamsChange({ ...params, quality: value });
                  appendOperationLog({ source: "创作台", message: `已切换质量为 ${value}` });
                }}
              />
            </div>
          </div>

          <div className="composer-footer-middle">
            <label className="composer-inline-field composer-footer-field composer-meta-field">
              <input className="composer-inline-input" value={artistName} onChange={(event) => setArtistName(event.target.value)} placeholder="艺名 / 标题" />
            </label>
            {/*<label className="composer-inline-field composer-footer-field composer-meta-field">
              <input className="composer-inline-input" value={mustHave} onChange={(event) => setMustHave(event.target.value)} placeholder="必须包含" />
            </label>
            <label className="composer-inline-field composer-footer-field composer-meta-field">
              <input className="composer-inline-input" value={avoid} onChange={(event) => setAvoid(event.target.value)} placeholder="避免出现" />
            </label>*/}
            <label className="composer-inline-field composer-slider-field composer-footer-field composer-slider-pill">
              <span>发散 {temperature.toFixed(1)}</span>
              <input type="range" min={0} max={1.2} step={0.1} value={temperature} onChange={(event) => setTemperature(Number(event.target.value))} />
            </label>
          </div>

          <div className="composer-footer-right">
            <div className="composer-footer-assets">
              <UploadArea title="参考图" bucket="referenceImages" assets={referenceImages} onAdd={addImages} onRemove={removeAsset} />
              <UploadArea title="素材图" bucket="materialImages" assets={materialImages} onAdd={addImages} onRemove={removeAsset} />
              <UploadArea title="头像" bucket="avatarImages" assets={avatarImages} onAdd={addImages} onRemove={removeAsset} single />
            </div>
            <div className="composer-footer-actions">
              <button type="button" className="ghost-button composer-icon-button" title="复制提示词" aria-label="复制提示词" onClick={() => void copyGeneratedPrompt()}>
                <Copy size={12} />
              </button>
              <button type="button" className="ghost-button composer-icon-button" title="重置表单" aria-label="重置表单" onClick={resetForm}>
                <RefreshCw size={12} />
              </button>
              <button type="button" className="generate-button composer-submit-button" disabled={!canGenerate} onClick={() => void submitPlaylist()}>
                {isSubmitting || currentTask?.status === "pending" || currentTask?.status === "running" ? <Loader2 className="spin" size={16} /> : <ImagePlus size={16} />}
                {isSubmitting || currentTask?.status === "pending" || currentTask?.status === "running" ? "生成中" : "生成"}
              </button>
            </div>
          </div>
        </div>
      </section>
    </section>
  );
}

interface UploadAreaProps {
  title: string;
  bucket: UploadBucket;
  assets: UploadAsset[];
  single?: boolean;
  onAdd: (files: FileList | File[], bucket: UploadBucket) => void;
  onRemove: (bucket: UploadBucket, id: string) => void;
}

function UploadArea({ title, bucket, assets, single, onAdd, onRemove }: UploadAreaProps) {
  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    onAdd(event.dataTransfer.files, bucket);
  }

  function handleInput(event: ChangeEvent<HTMLInputElement>) {
    if (event.target.files) {
      onAdd(event.target.files, bucket);
      event.target.value = "";
    }
  }

  return (
    <div className="upload-block">
      <label className="mini-dropzone" onDragOver={(event) => event.preventDefault()} onDrop={handleDrop}>
        <input type="file" accept="image/*" multiple={!single} onChange={handleInput} />
        <UploadCloud size={18} />
        <span>{title}</span>
      </label>
      {assets.length ? (
        <div className="preview-strip has-items">
          {assets.map((asset) => (
            <div className="thumb" key={asset.id}>
              <img src={asset.previewUrl} alt={asset.file.name} />
              <button type="button" onClick={() => onRemove(bucket, asset.id)} aria-label="移除图片">
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function renderBucketLabel(bucket: UploadBucket): string {
  if (bucket === "avatarImages") return "头像素材";
  if (bucket === "referenceImages") return "参考图";
  return "素材图";
}

function formatDuration(ms: number): string {
  return `${Math.floor(Math.max(0, ms) / 1000)} 秒`;
}

function renderTaskStatus(task?: ImageTask): string {
  if (!task) return "等待生成";
  if (task.status === "pending") return "任务排队中";
  if (task.status === "running") return "后台生成中";
  if (task.status === "succeeded") return "生成完成";
  if (task.status === "failed") return "生成失败";
  return "已停止等待";
}

function downloadImage(imageUrl: string, artistName: string, presetId: string) {
  const presetLabel = visualPrompts.find((preset) => preset.id === presetId)?.label || "默认模板";
  const filename = `${sanitizeFilenamePart(artistName, "未命名艺名")}-歌单-${sanitizeFilenamePart(presetLabel, "默认模板")}.png`;
  const link = document.createElement("a");
  link.href = new URL(imageUrl, getBackendOrigin()).toString();
  link.download = filename;
  link.target = "_blank";
  link.click();
}

function sanitizeFilenamePart(value: string, fallback: string): string {
  const cleaned = value.trim().replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").replace(/\.+$/g, "");
  return cleaned || fallback;
}

function createId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
