import { Eye, EyeOff, KeyRound, RefreshCw, Settings2, ShieldCheck, SlidersHorizontal, Sparkles, WandSparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { InvalidBackendApiBaseUrlError, setApiBaseUrl as applyApiBaseUrl } from "../../api/client";
import { SelectMenu } from "../common/SelectMenu";
import { useConfigStore } from "../../stores/configStore";
import { usePlaylistDraftStore } from "../../stores/playlistDraftStore";
import type { GenerateInput, ModelItem } from "../../types";
import { appendOperationLog } from "../../utils/operationLog";

interface ApiConfigPanelProps {
  models: ModelItem[];
  params: GenerateInput;
  onParamsChange: (params: GenerateInput) => void;
  onRestartBackend: () => void;
}

type SettingsSection = "connection" | "output" | "creative" | "advanced";

const proxyOptions = [
  { value: "none", label: "不使用代理" },
  { value: "system", label: "系统代理" },
  { value: "http", label: "HTTP 代理" },
  { value: "socks5", label: "SOCKS5 代理" }
] as const;

const qualityOptions: Array<{ value: GenerateInput["quality"]; label: string }> = [
  { value: "auto", label: "自动" },
  { value: "standard", label: "标准" },
  { value: "high", label: "高质量" }
];

export function ApiConfigPanel({ models, params, onParamsChange, onRestartBackend }: ApiConfigPanelProps) {
  const [section, setSection] = useState<SettingsSection>("connection");
  const [showKey, setShowKey] = useState(false);
  const [showTemporaryKey, setShowTemporaryKey] = useState(false);
  const [baseUrlDraft, setBaseUrlDraft] = useState("");
  const [upstreamApiBaseDraft, setUpstreamApiBaseDraft] = useState("");
  const [apiKeyDraft, setApiKeyDraft] = useState("");

  const apiBaseUrl = useConfigStore((state) => state.apiBaseUrl);
  const upstreamApiBase = useConfigStore((state) => state.upstreamApiBase);
  const apiKey = useConfigStore((state) => state.apiKey);
  const temporaryApiKey = useConfigStore((state) => state.temporaryApiKey);
  const useServerKey = useConfigStore((state) => state.useServerKey);
  const proxyMode = useConfigStore((state) => state.proxyMode);
  const capabilities = useConfigStore((state) => state.capabilities);
  const setApiBaseUrl = useConfigStore((state) => state.setApiBaseUrl);
  const setUpstreamApiBase = useConfigStore((state) => state.setUpstreamApiBase);
  const setApiKey = useConfigStore((state) => state.setApiKey);
  const setTemporaryApiKey = useConfigStore((state) => state.setTemporaryApiKey);
  const setUseServerKey = useConfigStore((state) => state.setUseServerKey);
  const setProxyMode = useConfigStore((state) => state.setProxyMode);

  const mustHave = usePlaylistDraftStore((state) => state.mustHave);
  const avoid = usePlaylistDraftStore((state) => state.avoid);
  const temperature = usePlaylistDraftStore((state) => state.temperature);
  const setMustHave = usePlaylistDraftStore((state) => state.setMustHave);
  const setAvoid = usePlaylistDraftStore((state) => state.setAvoid);
  const setTemperature = usePlaylistDraftStore((state) => state.setTemperature);

  const activeModel = useMemo(() => models.find((item) => item.id === params.model), [models, params.model]);

  useEffect(() => {
    setBaseUrlDraft(apiBaseUrl);
  }, [apiBaseUrl]);

  useEffect(() => {
    setUpstreamApiBaseDraft(upstreamApiBase);
  }, [upstreamApiBase]);

  useEffect(() => {
    setApiKeyDraft(apiKey);
  }, [apiKey]);

  function updateParam<K extends keyof GenerateInput>(key: K, value: GenerateInput[K], message: string) {
    onParamsChange({ ...params, [key]: value });
    appendOperationLog({ source: "设置", message, detail: { key, value } });
  }

  function saveApiConfig() {
    const nextBaseUrl = baseUrlDraft.trim() || apiBaseUrl;
    const nextUpstreamApiBase = upstreamApiBaseDraft.trim() || upstreamApiBase;
    const nextApiKey = apiKeyDraft.trim();
    setUpstreamApiBase(nextUpstreamApiBase);
    setApiKey(nextApiKey);

    try {
      setApiBaseUrl(nextBaseUrl);
      applyApiBaseUrl(nextBaseUrl);
      appendOperationLog({
        source: "设置",
        message: "已保存 API 配置",
        detail: {
          apiBaseUrl: useConfigStore.getState().apiBaseUrl,
          upstreamApiBase: useConfigStore.getState().upstreamApiBase,
          hasLocalKey: Boolean(nextApiKey)
        }
      });
    } catch (error) {
      appendOperationLog({
        source: "设置",
        level: "warn",
        message: "已保存 API 与 Key，但本地服务地址未更新",
        detail: error instanceof InvalidBackendApiBaseUrlError ? error.message : "本地后端地址无效，请检查后重试"
      });
    }
  }

  return (
    <section className="settings-panel settings-workspace">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Settings</p>
          <h2>工作台设置</h2>
        </div>
        <Settings2 size={18} />
      </div>

      <div className="settings-tabs" role="tablist" aria-label="设置分类">
        {[
          { id: "connection" as const, label: "连接与鉴权", icon: ShieldCheck },
          { id: "output" as const, label: "默认输出", icon: WandSparkles },
          { id: "creative" as const, label: "创作偏好", icon: Sparkles },
          { id: "advanced" as const, label: "高级采样", icon: SlidersHorizontal }
        ].map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              className={section === item.id ? "settings-tab active" : "settings-tab"}
              onClick={() => {
                setSection(item.id);
                appendOperationLog({ source: "设置", message: `切换到${item.label}` });
              }}
            >
              <Icon size={15} />
              {item.label}
            </button>
          );
        })}
      </div>

      {section === "connection" && (
        <div className="settings-grid">
          <section className="settings-section">
            <div className="settings-section-head">
              <h3>接口配置</h3>
              <p>这里只需要填写你真正能调通的图片接口地址和 Key。像你另一个页面里能用的 `https://harin.52pick.com/v1`，就应该填在这里。</p>
            </div>

            <label className="field-block">
              <span>API 地址</span>
              <input value={upstreamApiBaseDraft} placeholder="https://harin.52pick.com/v1" onChange={(event) => setUpstreamApiBaseDraft(event.target.value)} />
            </label>

            <label className="field-block">
              <span>API Key</span>
              <div className="compound-input">
                <input type={showKey ? "text" : "password"} value={apiKeyDraft} autoComplete="off" placeholder="sk-..." onChange={(event) => setApiKeyDraft(event.target.value)} />
                <button type="button" className="inline-icon-button" onClick={() => setShowKey((value) => !value)}>
                  {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </label>

            <label className="toggle-row">
              <input
                type="checkbox"
                checked={useServerKey}
                disabled={!capabilities?.server_key_configured}
                onChange={(event) => {
                  setUseServerKey(event.target.checked);
                  appendOperationLog({
                    source: "设置",
                    message: event.target.checked ? "已启用服务端默认 Key" : "已关闭服务端默认 Key"
                  });
                }}
              />
              <span>使用服务端默认 Key</span>
            </label>

            <div className="settings-summary">
              <span>
                <KeyRound size={13} />
                {useServerKey
                  ? apiKey
                    ? "当前使用服务端 Key，本地 Key 已保存"
                    : "当前使用服务端 Key"
                  : apiKey
                    ? "当前使用本地 Key"
                    : "当前不携带 Key"}
              </span>
            </div>
          </section>

          <section className="settings-section">
            <div className="settings-section-head">
              <h3>代理与维护</h3>
              <p>低频维护动作放进同一块，避免首页出现系统控制项。</p>
            </div>

            <label className="field-block">
              <span>代理模式</span>
              <SelectMenu
                ariaLabel="代理模式"
                value={proxyMode}
                options={proxyOptions.map((option) => ({ value: option.value, label: option.label }))}
                fullWidth
                onChange={(value) => {
                  setProxyMode(value);
                  appendOperationLog({ source: "设置", message: `代理模式已切换为 ${value}` });
                }}
              />
            </label>

            <button type="button" className="ghost-button wide" onClick={saveApiConfig}>
              保存并应用 API / Key
            </button>

            <button
              type="button"
              className="ghost-button wide"
              onClick={() => {
                appendOperationLog({ source: "设置", message: "请求重启本地后端" });
                void onRestartBackend();
              }}
            >
              <RefreshCw size={14} />
              重启后端
            </button>
          </section>
        </div>
      )}

      {section === "output" && (
        <div className="settings-grid">
          <section className="settings-section">
            <div className="settings-section-head">
              <h3>默认输出</h3>
              <p>这里管理默认生成策略，主页只保留最常用的模型、尺寸和质量入口。</p>
            </div>

            <label className="field-block">
              <span>输出数量</span>
              <input type="number" min={1} max={4} value={params.n} onChange={(event) => updateParam("n", Number(event.target.value), "已调整默认输出数量")} />
            </label>

            <label className="field-block">
              <span>质量</span>
              <SelectMenu
                ariaLabel="默认质量"
                value={params.quality}
                options={qualityOptions}
                fullWidth
                onChange={(value) => updateParam("quality", value, "已调整默认输出质量")}
              />
            </label>
          </section>

          <section className="settings-section">
            <div className="settings-section-head">
              <h3>当前主舞台规格</h3>
              <p>主创作页直接可见的规格摘要。</p>
            </div>
            <div className="quick-stat-list">
              <span className="workflow-stat">模型 {activeModel?.name || params.model}</span>
              <span className="workflow-stat">尺寸 {params.size}</span>
              <span className="workflow-stat">数量 {params.n}</span>
              <span className="workflow-stat">质量 {params.quality}</span>
            </div>
          </section>
        </div>
      )}

      {section === "creative" && (
        <div className="settings-grid">
          <section className="settings-section">
            <div className="settings-section-head">
              <h3>补充要求</h3>
              <p>这些都是偏低频的创作要求，移到设置里避免首页过于拥挤。</p>
            </div>

            <label className="field-block">
              <span>必须包含</span>
              <input
                value={mustHave}
                placeholder="头像、霓虹灯、黑胶、艺名文字"
                onBlur={() => appendOperationLog({ source: "设置", message: "已更新必须包含要求", detail: mustHave })}
                onChange={(event) => setMustHave(event.target.value)}
              />
            </label>

            <label className="field-block">
              <span>避免出现</span>
              <input
                value={avoid}
                placeholder="低清、乱码、过度赛博"
                onBlur={() => appendOperationLog({ source: "设置", message: "已更新避免出现要求", detail: avoid })}
                onChange={(event) => setAvoid(event.target.value)}
              />
            </label>
          </section>

          <section className="settings-section">
            <div className="settings-section-head">
              <h3>风格发散度</h3>
              <p>保留一个轻量滑杆，不再在首页反复打扰。</p>
            </div>

            <label className="field-block">
              <span>发散度：{temperature.toFixed(1)}</span>
              <input
                type="range"
                min={0}
                max={1.2}
                step={0.1}
                value={temperature}
                onChange={(event) => {
                  const next = Number(event.target.value);
                  setTemperature(next);
                  appendOperationLog({ source: "设置", message: "已调整风格发散度", detail: next });
                }}
              />
            </label>
          </section>
        </div>
      )}

      {section === "advanced" && (
        <div className="settings-grid">
          <section className="settings-section">
            <div className="settings-section-head">
              <h3>高级采样</h3>
              <p>采样、引导强度和固定种子都归到这里。</p>
            </div>

            <label className="field-block">
              <span>采样步数：{params.steps ?? 20}</span>
              <input type="range" min={1} max={80} value={params.steps ?? 20} onChange={(event) => updateParam("steps", Number(event.target.value), "已调整采样步数")} />
            </label>

            <label className="field-block">
              <span>CFG Scale：{params.cfg_scale ?? 7}</span>
              <input type="range" min={1} max={20} step={0.5} value={params.cfg_scale ?? 7} onChange={(event) => updateParam("cfg_scale", Number(event.target.value), "已调整 CFG Scale")} />
            </label>

            <label className="field-block">
              <span>Seed</span>
              <input
                type="number"
                placeholder="留空则随机"
                value={params.seed ?? ""}
                onBlur={() => appendOperationLog({ source: "设置", message: "已更新 Seed", detail: params.seed ?? "随机" })}
                onChange={(event) => onParamsChange({ ...params, seed: event.target.value ? Number(event.target.value) : undefined })}
              />
            </label>
          </section>

          <section className="settings-section">
            <div className="settings-section-head">
              <h3>单次覆盖凭证</h3>
              <p>只有当前工作流需要临时绕开全局鉴权策略时，才需要填写。</p>
            </div>

            <label className="field-block">
              <span>覆盖 Key</span>
              <div className="compound-input">
                <input
                  type={showTemporaryKey ? "text" : "password"}
                  value={temporaryApiKey}
                  placeholder="留空则沿用全局 Key 策略"
                  onBlur={() => appendOperationLog({ source: "设置", message: temporaryApiKey ? "已更新单次覆盖 Key" : "已清空单次覆盖 Key" })}
                  onChange={(event) => setTemporaryApiKey(event.target.value)}
                />
                <button type="button" className="inline-icon-button" onClick={() => setShowTemporaryKey((value) => !value)}>
                  {showTemporaryKey ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </label>
          </section>
        </div>
      )}
    </section>
  );
}
