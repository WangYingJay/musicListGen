import { Loader2, Play, RotateCcw } from "lucide-react";

import { appendOperationLog } from "../../utils/operationLog";

interface PromptPanelProps {
  prompt: string;
  negativePrompt: string;
  isSubmitting: boolean;
  onPromptChange: (prompt: string) => void;
  onNegativePromptChange: (prompt: string) => void;
  onGenerate: () => void;
}

const quickTerms = ["夜晚城市", "雨夜地铁", "黑胶休息室", "卧室耳机", "电影感", "胶片颗粒", "studio lighting"];

export function PromptPanel({
  prompt,
  negativePrompt,
  isSubmitting,
  onPromptChange,
  onNegativePromptChange,
  onGenerate
}: PromptPanelProps) {
  const disabled = isSubmitting || prompt.trim().length === 0;

  return (
    <section className="workspace-section prompt-workspace">
      <div className="section-header">
        <div>
          <p className="eyebrow">Prompt</p>
          <h1>歌单海报生成</h1>
        </div>
        <button
          type="button"
          className="ghost-button"
          onClick={() => {
            onPromptChange("");
            appendOperationLog({ source: "图生图", message: "已清空提示词输入" });
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
              appendOperationLog({ source: "图生图", message: `已追加快捷提示词：${term}` });
            }}
          >
            {term}
          </button>
        ))}
      </div>

      <label className="field-block stretch">
        <span>正向提示词</span>
        <textarea
          value={prompt}
          onChange={(event) => onPromptChange(event.target.value)}
          placeholder="一张适合作为歌单封面的视觉海报，主体、氛围、颜色、构图..."
        />
      </label>

      <label className="field-block">
        <span>反向提示词</span>
        <textarea
          value={negativePrompt}
          onChange={(event) => onNegativePromptChange(event.target.value)}
          placeholder="低清晰度、变形文字、杂乱背景..."
        />
      </label>

      <button
        type="button"
        className="generate-button"
        disabled={disabled}
        onClick={() => {
          appendOperationLog({ source: "图生图", message: "点击生成图像" });
          onGenerate();
        }}
      >
        {isSubmitting ? <Loader2 className="spin" size={18} /> : <Play size={18} />}
        {isSubmitting ? "提交中..." : "生成图片"}
      </button>
    </section>
  );
}
