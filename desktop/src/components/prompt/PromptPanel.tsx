import { Loader2, Play, RotateCcw } from "lucide-react";

import { appendOperationLog } from "../../utils/operationLog";

interface PromptPanelProps {
  prompt: string;
  negativePrompt: string;
  isSubmitting: boolean;
  eyebrow?: string;
  title?: string;
  quickTerms?: string[];
  logSource?: string;
  promptLabel?: string;
  negativePromptLabel?: string;
  promptPlaceholder?: string;
  negativePromptPlaceholder?: string;
  submitLabel?: string;
  submittingLabel?: string;
  onPromptChange: (prompt: string) => void;
  onNegativePromptChange: (prompt: string) => void;
  onGenerate: () => void;
}

const defaultQuickTerms = ["夜晚城市", "雨夜地铁", "黑胶休息室", "卧室耳机", "电影感", "胶片颗粒", "studio lighting"];

export function PromptPanel({
  prompt,
  negativePrompt,
  isSubmitting,
  eyebrow = "Prompt",
  title = "歌单海报生成",
  quickTerms = defaultQuickTerms,
  logSource = "图生图",
  promptLabel = "正向提示词",
  negativePromptLabel = "反向提示词",
  promptPlaceholder = "一张适合作为歌单封面的视觉海报，主体、氛围、颜色、构图...",
  negativePromptPlaceholder = "低清晰度、变形文字、杂乱背景...",
  submitLabel = "生成图片",
  submittingLabel = "提交中...",
  onPromptChange,
  onNegativePromptChange,
  onGenerate
}: PromptPanelProps) {
  const disabled = isSubmitting || prompt.trim().length === 0;

  return (
    <section className="workspace-section prompt-workspace">
      <div className="section-header">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
        </div>
        <button
          type="button"
          className="ghost-button"
          onClick={() => {
            onPromptChange("");
            appendOperationLog({ source: logSource, message: "已清空提示词输入" });
          }}
        >
          <RotateCcw size={14} />
          清空
        </button>
      </div>

      <div className="quick-term-row">
        {quickTerms.map((term) => (
          <button
            key={term}
            type="button"
            className="term-chip"
            onClick={() => {
              onPromptChange(prompt ? `${prompt}，${term}` : term);
              appendOperationLog({ source: logSource, message: `已追加快捷提示词：${term}` });
            }}
          >
            {term}
          </button>
        ))}
      </div>

      <label className="field-block stretch">
        <span>{promptLabel}</span>
        <textarea
          value={prompt}
          onChange={(event) => onPromptChange(event.target.value)}
          placeholder={promptPlaceholder}
        />
      </label>

      <label className="field-block">
        <span>{negativePromptLabel}</span>
        <textarea
          value={negativePrompt}
          onChange={(event) => onNegativePromptChange(event.target.value)}
          placeholder={negativePromptPlaceholder}
        />
      </label>

      <button
        type="button"
        className="generate-button"
        disabled={disabled}
        onClick={() => {
          appendOperationLog({ source: logSource, message: "点击生成图像" });
          onGenerate();
        }}
      >
        {isSubmitting ? <Loader2 className="spin" size={18} /> : <Play size={18} />}
        {isSubmitting ? submittingLabel : submitLabel}
      </button>
    </section>
  );
}
