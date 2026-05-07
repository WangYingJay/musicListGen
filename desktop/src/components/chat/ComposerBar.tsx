import { Bot, Copy, ImagePlus, ListMusic, RefreshCw, RotateCcw, SlidersHorizontal, Sparkles, UserRound, X } from "lucide-react";
import { type ChangeEvent, useId, useMemo } from "react";

import { SelectMenu } from "../common/SelectMenu";
import type { GenerateInput, ModelItem } from "../../types";

export type ComposerPanel = "songs" | "identity" | "assets" | "options" | null;
export type ComposerUploadBucket = "avatarImages" | "referenceImages" | "materialImages";

interface UploadChip {
  id: string;
  name: string;
  size: number;
  type: string;
  previewUrl: string;
}

interface ComposerBarProps {
  visualPrompt: string;
  songList: string;
  artistName: string;
  mustHave: string;
  avoid: string;
  temperature: number;
  params: GenerateInput;
  models: ModelItem[];
  activePanel: ComposerPanel;
  avatarItems: UploadChip[];
  referenceItems: UploadChip[];
  materialItems: UploadChip[];
  isSubmitting: boolean;
  isBusy: boolean;
  onPanelChange: (panel: ComposerPanel) => void;
  onVisualPromptChange: (value: string) => void;
  onSongListChange: (value: string) => void;
  onArtistNameChange: (value: string) => void;
  onMustHaveChange: (value: string) => void;
  onAvoidChange: (value: string) => void;
  onTemperatureChange: (value: number) => void;
  onParamsChange: (params: GenerateInput) => void;
  onAddImages: (bucket: ComposerUploadBucket, files: FileList | File[]) => void;
  onRemoveAsset: (bucket: ComposerUploadBucket, id: string) => void;
  onCopyPromptDraft: () => void;
  onRefreshPromptTemplate: () => void;
  onReset: () => void;
  onSubmit: () => void;
}

const fallbackModels: ModelItem[] = [
  { id: "gpt-image-2", name: "GPT Image 2", supports_edit: true, sizes: ["1024x1024", "1024x1536", "1536x1024"] }
];

const qualityOptions: Array<{ value: GenerateInput["quality"]; label: string }> = [
  { value: "auto", label: "自动质量" },
  { value: "standard", label: "标准质量" },
  { value: "high", label: "高质量" }
];

export function ComposerBar({
  visualPrompt,
  songList,
  artistName,
  mustHave,
  avoid,
  temperature,
  params,
  models,
  activePanel,
  avatarItems,
  referenceItems,
  materialItems,
  isSubmitting,
  isBusy,
  onPanelChange,
  onVisualPromptChange,
  onSongListChange,
  onArtistNameChange,
  onMustHaveChange,
  onAvoidChange,
  onTemperatureChange,
  onParamsChange,
  onAddImages,
  onRemoveAsset,
  onCopyPromptDraft,
  onRefreshPromptTemplate,
  onReset,
  onSubmit
}: ComposerBarProps) {
  const idPrefix = useId();
  const modelOptions = models.length > 0 ? models : fallbackModels;
  const activeModel = useMemo(() => modelOptions.find((model) => model.id === params.model) || modelOptions[0], [modelOptions, params.model]);
  const allUploads = [
    ...referenceItems.map((item) => ({ ...item, bucket: "referenceImages" as const, label: "参考图" })),
    ...materialItems.map((item) => ({ ...item, bucket: "materialImages" as const, label: "素材图" }))
  ];
  const uploadCount = avatarItems.length + referenceItems.length + materialItems.length;
  const disabled = isBusy || visualPrompt.trim().length === 0;

  return (
    <section className="chat-composer-shell" aria-label="创作输入区">
      <div className="chat-composer">
        {allUploads.length > 0 ? (
          <div className="composer-upload-strip">
            {allUploads.map((item) => (
              <span key={item.id} className="composer-upload-chip">
                <img src={item.previewUrl} alt={item.name} />
                <span className="composer-upload-chip-copy">
                  <i>{item.label}</i>
                  <strong>{item.name}</strong>
                  <small>{formatFileSize(item.size)}</small>
                </span>
                <button type="button" onClick={() => onRemoveAsset(item.bucket, item.id)} aria-label={`移除${item.name}`}>
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
        ) : null}

        <textarea
          className="chat-composer-input"
          value={visualPrompt}
          onChange={(event) => onVisualPromptChange(event.target.value)}
          placeholder="描述风格、氛围、歌单主题，或上传参考图开始"
          rows={4}
        />

        <div className="chat-composer-toolbar">
          <div className="chat-composer-toolbar-left">
            <button
              type="button"
              className={activePanel === "assets" ? "composer-tool-button active" : "composer-tool-button"}
              onClick={() => onPanelChange(activePanel === "assets" ? null : "assets")}
            >
              <ImagePlus size={15} />
              <span>图片</span>
              {uploadCount > 0 ? <i className="composer-tool-count">{uploadCount}</i> : null}
            </button>
            <button
              type="button"
              className={activePanel === "songs" ? "composer-tool-button active" : "composer-tool-button"}
              onClick={() => onPanelChange(activePanel === "songs" ? null : "songs")}
            >
              <ListMusic size={15} />
              <span>歌单</span>
            </button>
            <button
              type="button"
              className={activePanel === "identity" ? "composer-tool-button active" : "composer-tool-button"}
              onClick={() => onPanelChange(activePanel === "identity" ? null : "identity")}
            >
              <UserRound size={15} />
              <span>艺名</span>
            </button>
            <button
              type="button"
              className={activePanel === "options" ? "composer-tool-button active" : "composer-tool-button"}
              onClick={() => onPanelChange(activePanel === "options" ? null : "options")}
            >
              <SlidersHorizontal size={15} />
              <span>更多参数</span>
            </button>
          </div>

          <div className="chat-composer-toolbar-right">
            <button type="button" className="composer-tool-button" aria-label="刷新提示词模板" title="刷新提示词模板" onClick={onRefreshPromptTemplate}>
              <RefreshCw size={15} />
              <span>刷新模板</span>
            </button>
            <button type="button" className="composer-icon-button" aria-label="复制提示词草稿" onClick={onCopyPromptDraft}>
              <Copy size={15} />
            </button>
            <button type="button" className="composer-icon-button" aria-label="重置当前表单" onClick={onReset}>
              <RotateCcw size={15} />
            </button>
            <span className="composer-mode-pill">歌单生成</span>
            <button type="button" className="chat-submit-button" disabled={disabled} onClick={onSubmit}>
              <Sparkles size={16} />
              <span>{isSubmitting || isBusy ? "生成中" : "生成"}</span>
            </button>
          </div>
        </div>

        {activePanel ? (
          <div className="composer-expanded-panel">
            {activePanel === "songs" ? (
              <label className="composer-field">
                <span>歌曲列表</span>
                <textarea
                  value={songList}
                  onChange={(event) => onSongListChange(event.target.value)}
                  placeholder="每行一首歌，支持“歌手 - 歌名”格式"
                  rows={8}
                />
              </label>
            ) : null}

            {activePanel === "identity" ? (
              <div className="composer-panel-grid two-columns">
                <label className="composer-field">
                  <span>艺名 / 标题</span>
                  <input value={artistName} onChange={(event) => onArtistNameChange(event.target.value)} placeholder="例如：午夜回声 / 夏日晚风" />
                </label>
                <label className="composer-field">
                  <span>画面必须包含</span>
                  <input value={mustHave} onChange={(event) => onMustHaveChange(event.target.value)} placeholder="例如：耳机、城市倒影、人物侧脸" />
                </label>
                <label className="composer-field full-span">
                  <span>尽量避免出现</span>
                  <textarea value={avoid} onChange={(event) => onAvoidChange(event.target.value)} placeholder="例如：花哨边框、过度发光、难以辨认的文字" rows={4} />
                </label>
              </div>
            ) : null}

            {activePanel === "assets" ? (
              <div className="composer-panel-grid three-columns">
                <UploadBucketPanel
                  id={`${idPrefix}-avatar`}
                  title="头像"
                  hint="更适合放人物或艺人形象参考"
                  items={avatarItems}
                  uploadedLabel="已上传头像"
                  addLabel={avatarItems.length > 0 ? "更换头像" : "添加头像"}
                  onAdd={(files) => onAddImages("avatarImages", files)}
                  onRemove={(id) => onRemoveAsset("avatarImages", id)}
                />
                <UploadBucketPanel
                  id={`${idPrefix}-reference`}
                  title="参考图"
                  hint="用于借鉴构图、色彩与氛围"
                  items={referenceItems}
                  onAdd={(files) => onAddImages("referenceImages", files)}
                  onRemove={(id) => onRemoveAsset("referenceImages", id)}
                />
                <UploadBucketPanel
                  id={`${idPrefix}-material`}
                  title="素材图"
                  hint="用于把主体、物件和场景融进画面"
                  items={materialItems}
                  onAdd={(files) => onAddImages("materialImages", files)}
                  onRemove={(id) => onRemoveAsset("materialImages", id)}
                />
              </div>
            ) : null}

            {activePanel === "options" ? (
              <div className="composer-panel-grid options-grid">
                <label className="composer-field">
                  <span>模型</span>
                  <SelectMenu
                    ariaLabel="模型"
                    value={params.model}
                    options={modelOptions.map((model) => ({ value: model.id, label: model.name }))}
                    icon={<Bot size={14} />}
                    fullWidth
                    onChange={(value) => {
                      const nextModel = modelOptions.find((model) => model.id === value) || modelOptions[0];
                      const nextSize = nextModel.sizes.includes(params.size) ? params.size : nextModel.sizes[0];
                      onParamsChange({ ...params, model: value, size: nextSize });
                    }}
                  />
                </label>

                <label className="composer-field">
                  <span>尺寸</span>
                  <SelectMenu
                    ariaLabel="尺寸"
                    value={params.size}
                    options={activeModel.sizes.map((size) => ({ value: size, label: size }))}
                    fullWidth
                    onChange={(value) => onParamsChange({ ...params, size: value })}
                  />
                </label>

                <label className="composer-field">
                  <span>质量</span>
                  <SelectMenu
                    ariaLabel="质量"
                    value={params.quality}
                    options={qualityOptions}
                    fullWidth
                    onChange={(value) => onParamsChange({ ...params, quality: value })}
                  />
                </label>

                <label className="composer-field full-span">
                  <span>风格发散度 {temperature.toFixed(1)}</span>
                  <input type="range" min={0} max={1.2} step={0.1} value={temperature} onChange={(event) => onTemperatureChange(Number(event.target.value))} />
                </label>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}

interface UploadBucketPanelProps {
  id: string;
  title: string;
  hint: string;
  items: UploadChip[];
  uploadedLabel?: string;
  addLabel?: string;
  onAdd: (files: FileList | File[]) => void;
  onRemove: (id: string) => void;
}

function UploadBucketPanel({ id, title, hint, items, uploadedLabel = "已上传图片", addLabel = "添加图片", onAdd, onRemove }: UploadBucketPanelProps) {
  const primaryItem = items[0];

  return (
    <div className="composer-upload-panel">
      <div className="composer-upload-panel-head">
        <strong>{title}</strong>
        <span>{hint}</span>
      </div>

      {primaryItem ? (
        <div className="composer-upload-confirm-card">
          <img src={primaryItem.previewUrl} alt={primaryItem.name} />
          <div>
            <span>{uploadedLabel}</span>
            <strong>{primaryItem.name}</strong>
            <small>
              {formatFileSize(primaryItem.size)}
              {primaryItem.type ? ` · ${formatImageType(primaryItem.type)}` : ""}
            </small>
          </div>
          <button type="button" onClick={() => onRemove(primaryItem.id)} aria-label={`移除${primaryItem.name}`}>
            <X size={13} />
          </button>
        </div>
      ) : null}

      <label htmlFor={id} className="composer-upload-drop">
        <ImagePlus size={16} />
        <span>{addLabel}</span>
      </label>
      <input
        id={id}
        type="file"
        accept="image/*,.png,.jpg,.jpeg,.webp,.gif,.bmp,.heic,.heif,.tif,.tiff"
        multiple
        hidden
        onChange={(event: ChangeEvent<HTMLInputElement>) => {
          if (event.target.files?.length) {
            onAdd(event.target.files);
          }
          event.target.value = "";
        }}
      />

      <div className="composer-upload-preview-list">
        {items.map((item) => (
          <span key={item.id} className="composer-upload-preview">
            <img src={item.previewUrl} alt={item.name} />
            <span>
              <strong>{item.name}</strong>
              <small>
                {formatFileSize(item.size)}
                {item.type ? ` · ${formatImageType(item.type)}` : ""}
              </small>
            </span>
            <button type="button" onClick={() => onRemove(item.id)} aria-label={`移除${item.name}`}>
              <X size={12} />
            </button>
          </span>
        ))}
        {items.length === 0 ? <p className="composer-upload-empty">还没有添加图片</p> : null}
      </div>
    </div>
  );
}

function formatFileSize(size: number): string {
  if (!Number.isFinite(size) || size <= 0) {
    return "未知大小";
  }
  if (size < 1024 * 1024) {
    return `${Math.max(1, Math.round(size / 1024))} KB`;
  }
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function formatImageType(type: string): string {
  return type.replace(/^image\//, "").toUpperCase();
}
