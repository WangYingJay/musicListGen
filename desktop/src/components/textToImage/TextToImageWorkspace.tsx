import { Copy, Download, ImageIcon, Settings2, Sparkles } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { getBackendOrigin } from "../../api/client";
import { createGeneration } from "../../api/image";
import { SelectMenu } from "../common/SelectMenu";
import { PromptPanel } from "../prompt/PromptPanel";
import { useConfigStore } from "../../stores/configStore";
import { useTaskStore } from "../../stores/taskStore";
import { showToast } from "../../stores/toastStore";
import type { GenerateInput, ImageTask, ModelItem } from "../../types";
import { saveImageWithSystemDialog } from "../../utils/imageSaver";
import { appendOperationLog } from "../../utils/operationLog";
import { getTaskCreationMode } from "../../utils/taskGrouping";

interface TextToImageWorkspaceProps {
  params: GenerateInput;
  resetSignal?: number;
  onParamsChange: (params: GenerateInput) => void;
  onOpenSettings: () => void;
}

const defaultPrompt = "一张面向音乐推荐内容的视觉海报，主体清晰，空间层次丰富，适合作为社交平台封面图";
const defaultNegativePrompt = "低清晰度，畸形手指，乱码文字，水印，过度锐化";
const textImageQuickTerms = ["电影感布光", "干净留白", "高端杂志感", "赛博城市", "自然柔光", "极简构图", "细腻颗粒"];
const fallbackModels: ModelItem[] = [
  { id: "gpt-image-2", name: "GPT Image 2", supports_edit: true, sizes: ["1024x1024", "1024x1536", "1536x1024"] }
];

export function TextToImageWorkspace({ params, resetSignal = 0, onParamsChange, onOpenSettings }: TextToImageWorkspaceProps) {
  const [prompt, setPrompt] = useState(defaultPrompt);
  const [negativePrompt, setNegativePrompt] = useState(defaultNegativePrompt);
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const hasHandledResetRef = useRef(false);

  const tasksById = useTaskStore((state) => state.tasks);
  const selectedTaskId = useTaskStore((state) => state.selectedTaskId);
  const addTaskFromResponse = useTaskStore((state) => state.addTaskFromResponse);
  const selectTask = useTaskStore((state) => state.selectTask);
  const models = useConfigStore((state) => state.models);
  const backendBaseUrl = useConfigStore((state) => state.backend.baseUrl);
  const globalApiKey = useConfigStore((state) => state.apiKey);
  const temporaryApiKey = useConfigStore((state) => state.temporaryApiKey);
  const useServerKey = useConfigStore((state) => state.useServerKey);
  const capabilities = useConfigStore((state) => state.capabilities);
  const upstreamApiBase = useConfigStore((state) => state.upstreamApiBase);

  const currentTask = currentTaskId ? tasksById[currentTaskId] : undefined;
  const selectedTask = selectedTaskId ? tasksById[selectedTaskId] : undefined;
  const selectedTextImageTask = selectedTask && getTaskCreationMode(selectedTask) === "textToImage" ? selectedTask : undefined;
  const modelOptions = models.length > 0 ? models : fallbackModels;
  const activeModel = modelOptions.find((model) => model.id === params.model) || modelOptions[0];
  const effectiveApiKey = useMemo(() => {
    const overrideKey = temporaryApiKey.trim();
    if (overrideKey) {
      return overrideKey;
    }
    const canUseServerKey = Boolean(capabilities?.server_key_configured);
    return canUseServerKey && useServerKey ? "" : globalApiKey.trim();
  }, [capabilities?.server_key_configured, globalApiKey, temporaryApiKey, useServerKey]);

  const textImageTasks = useMemo(
    () =>
      Object.values(tasksById)
        .filter((task) => getTaskCreationMode(task) === "textToImage")
        .sort((left, right) => right.created_at.localeCompare(left.created_at)),
    [tasksById]
  );
  const focusTask = selectedTextImageTask || currentTask || textImageTasks[0];
  const isBusy = currentTask?.status === "pending" || currentTask?.status === "running";

  useEffect(() => {
    if (!hasHandledResetRef.current) {
      hasHandledResetRef.current = true;
      return;
    }
    setPrompt(defaultPrompt);
    setNegativePrompt(defaultNegativePrompt);
    setCurrentTaskId(null);
    appendOperationLog({ source: "文字生图", message: "已重置文字生图草稿" });
  }, [resetSignal]);

  async function submitTextImage() {
    if (isBusy) {
      showToast({
        tone: "warn",
        title: "任务仍在运行",
        description: "请等待当前文字生图任务结束后再提交下一张"
      });
      return;
    }

    if (!prompt.trim()) {
      showToast({
        tone: "warn",
        title: "还不能生成",
        description: "请先输入文字提示词"
      });
      return;
    }

    setIsSubmitting(true);
    const input: GenerateInput = {
      ...params,
      prompt: prompt.trim(),
      negative_prompt: negativePrompt.trim() || undefined,
      workflow: "text-to-image",
      n: 1
    };

    try {
      const task = await createGeneration(input, effectiveApiKey, upstreamApiBase);
      addTaskFromResponse(task, input);
      setCurrentTaskId(task.task_id);
      selectTask(task.task_id);
      appendOperationLog({
        source: "文字生图",
        message: "已提交文字生图任务",
        detail: { taskId: task.task_id, model: input.model, size: input.size }
      });
      showToast({
        tone: "success",
        title: "文字生图任务已提交",
        description: `${input.model} · ${input.size}`
      });
    } catch (error) {
      appendOperationLog({
        source: "文字生图",
        level: "error",
        message: "文字生图任务提交失败",
        detail: error instanceof Error ? error.message : String(error)
      });
      showToast({
        tone: "error",
        title: "文字生图任务提交失败",
        description: error instanceof Error ? error.message : String(error)
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="view-shell text-image-workspace-shell">
      <header className="view-header">
        <div>
          <p className="eyebrow">Text To Image</p>
          <h1>文字生图</h1>
          <span>直接输入画面描述生成图片；需要参考图时再切换到图生图或歌单生成素材模式。</span>
        </div>
      </header>

      <div className="view-grid text-image-grid">
        <PromptPanel
          prompt={prompt}
          negativePrompt={negativePrompt}
          isSubmitting={isSubmitting || isBusy}
          title="画面提示词"
          quickTerms={textImageQuickTerms}
          logSource="文字生图"
          promptPlaceholder="描述主体、场景、镜头、颜色、光线、材质、构图和用途..."
          negativePromptPlaceholder="不想出现的元素，例如水印、乱码文字、低清晰度、畸形结构..."
          submitLabel={isBusy ? "任务运行中" : "生成图片"}
          submittingLabel={isBusy ? "任务运行中" : "提交中..."}
          onPromptChange={setPrompt}
          onNegativePromptChange={setNegativePrompt}
          onGenerate={() => void submitTextImage()}
        />

        <aside className="surface-card text-image-control-card">
          <div className="surface-card-head">
            <div>
              <h2>输出设置</h2>
              <p>文字生图共用全局模型和输出参数，提交时会保存为独立任务类型。</p>
            </div>
            <Sparkles size={18} />
          </div>

          <label className="field-block">
            <span>模型</span>
            <SelectMenu
              ariaLabel="模型"
              value={params.model}
              options={modelOptions.map((model) => ({ value: model.id, label: model.name }))}
              fullWidth
              onChange={(model) => {
                onParamsChange({ ...params, model });
                appendOperationLog({ source: "文字生图", message: `已切换模型为 ${model}` });
              }}
            />
          </label>

          <label className="field-block">
            <span>图片尺寸</span>
            <SelectMenu
              ariaLabel="图片尺寸"
              value={params.size}
              options={activeModel.sizes.map((size) => ({ value: size, label: size }))}
              fullWidth
              onChange={(size) => {
                onParamsChange({ ...params, size });
                appendOperationLog({ source: "文字生图", message: `已切换输出尺寸为 ${size}` });
              }}
            />
          </label>

          <div className="quick-panel-summary">
            <p>高级采样仍在设置页统一管理；这里保留最常用的模型和尺寸，避免每次生成前来回切换。</p>
            <div className="quick-stat-list">
              <span className="workflow-stat">数量 1</span>
              <span className="workflow-stat">质量 {params.quality}</span>
              <span className="workflow-stat">步数 {params.steps ?? 20}</span>
              <span className="workflow-stat">CFG {params.cfg_scale ?? 7}</span>
              <span className="workflow-stat">Seed {params.seed ?? "随机"}</span>
            </div>
          </div>

          <button
            type="button"
            className="ghost-button wide"
            onClick={() => {
              appendOperationLog({ source: "文字生图", message: "打开输出设置" });
              onOpenSettings();
            }}
          >
            <Settings2 size={15} />
            打开设置管理高级参数
          </button>
        </aside>
      </div>

      <TextImageResultPanel task={focusTask} backendBaseUrl={backendBaseUrl || getBackendOrigin()} />
    </section>
  );
}

function TextImageResultPanel({ task, backendBaseUrl }: { task?: ImageTask; backendBaseUrl: string }) {
  const imageUrl = task?.imageUrl ? new URL(task.imageUrl, backendBaseUrl).toString() : "";

  return (
    <section className="surface-card text-image-result-panel">
      <div className="surface-card-head">
        <div>
          <h2>结果预览</h2>
          <p>{task ? task.message || "任务状态等待回传" : "生成成功后会在这里预览，也会同步进入作品库。"}</p>
        </div>
        <span className={task ? `status-pill ${task.status}` : "status-pill"}>{task?.status || "等待生成"}</span>
      </div>

      <div className={imageUrl ? "text-image-result-stage has-image" : "text-image-result-stage"}>
        {imageUrl ? (
          <img src={imageUrl} alt={task?.prompt || "文字生图结果"} />
        ) : (
          <div>
            <ImageIcon size={36} />
            <strong>{task ? `${task.progress}%` : "暂无结果"}</strong>
            <span>{task?.error || task?.message || "写好提示词后提交第一张图"}</span>
          </div>
        )}
      </div>

      {task ? (
        <div className="text-image-result-copy">
          <pre className="prompt-preview-box">{task.prompt || "没有可展示的提示词"}</pre>
          <div className="workflow-actions result-column-actions">
            <button type="button" className="ghost-button" onClick={() => void copyPrompt(task.prompt)}>
              <Copy size={14} />
              复制提示词
            </button>
            <button type="button" className="ghost-button" disabled={!task.imageUrl} onClick={() => void saveImage(task.imageUrl, `${task.task_id}.png`)}>
              <Download size={14} />
              保存图片
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

async function copyPrompt(prompt: string) {
  if (!prompt) {
    return;
  }
  try {
    await navigator.clipboard.writeText(prompt);
    showToast({
      tone: "success",
      title: "已复制提示词"
    });
  } catch (error) {
    showToast({
      tone: "error",
      title: "复制提示词失败",
      description: error instanceof Error ? error.message : String(error)
    });
  }
}

async function saveImage(imageUrl: string | undefined, defaultName: string) {
  if (!imageUrl) {
    return;
  }
  try {
    const result = await saveImageWithSystemDialog(imageUrl, defaultName);
    if (result.saved) {
      showToast({
        tone: "success",
        title: "图片已保存",
        description: result.path || defaultName
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
