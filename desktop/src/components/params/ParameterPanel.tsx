import { ArrowRight, Settings2, SlidersHorizontal } from "lucide-react";

import { SelectMenu } from "../common/SelectMenu";
import type { GenerateInput, ModelItem } from "../../types";
import { appendOperationLog } from "../../utils/operationLog";

interface ParameterPanelProps {
  params: GenerateInput;
  models: ModelItem[];
  onChange: (params: GenerateInput) => void;
  onOpenSettings: () => void;
}

const fallbackModels: ModelItem[] = [
  { id: "gpt-image-2", name: "GPT Image 2", supports_edit: true, sizes: ["1024x1024", "1024x1536", "1536x1024"] }
];

export function ParameterPanel({ params, models, onChange, onOpenSettings }: ParameterPanelProps) {
  const modelOptions = models.length > 0 ? models : fallbackModels;
  const activeModel = modelOptions.find((model) => model.id === params.model) || modelOptions[0];

  return (
    <aside className="inspector">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Output</p>
          <h2>快速输出</h2>
        </div>
        <SlidersHorizontal size={17} />
      </div>

      <label className="field-block">
        <span>模型</span>
        <SelectMenu
          ariaLabel="模型"
          value={params.model}
          options={modelOptions.map((model) => ({ value: model.id, label: model.name }))}
          fullWidth
          onChange={(value) => {
            onChange({ ...params, model: value });
            appendOperationLog({ source: "快速输出", message: `已切换模型为 ${value}` });
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
          onChange={(value) => {
            onChange({ ...params, size: value });
            appendOperationLog({ source: "快速输出", message: `已切换输出尺寸为 ${value}` });
          }}
        />
      </label>

      <div className="quick-panel-summary">
        <p>低频参数已迁移到设置页分组管理，主界面只保留最常用的输出规格。</p>
        <div className="quick-stat-list">
          <span className="workflow-stat">数量 {params.n}</span>
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
          appendOperationLog({ source: "快速输出", message: "从快速输出面板打开设置页" });
          onOpenSettings();
        }}
      >
        <Settings2 size={15} />
        打开设置管理高级参数
        <ArrowRight size={14} />
      </button>
    </aside>
  );
}
