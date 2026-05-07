# 页面重构设计方案 - ChatGPT 风格 V1

## 1. 方案目标

本次重构目标不是单纯换皮，而是把当前 `musicListGen` 首页从“参数驱动的工具后台”重构为“输入驱动的会话式创作台”。

目标体验参考：

- 你提供的 ChatGPT 截图
- `chatgpt.com` 当前公开首页的排版和交互气质

需要对齐的核心感受：

1. 页面重心只有一个：输入框
2. 大留白，低噪音，白色中性色系
3. 左侧是轻量会话导航，不是信息密集型管理栏
4. 高级能力默认隐藏，按需展开
5. 结果展示像“对话里的回答”，不是传统右侧结果面板

同时必须保留本产品自己的业务主线：

1. 这是歌单封面生成工作台，不是通用聊天产品
2. 必须支持歌曲列表、艺名、参考图、素材图、参数控制
3. 必须保留任务异步生成、历史结果、保存下载、再次生成等核心能力

## 2. 当前页面问题

结合当前实现：

- [desktop/src/app/App.tsx](/Users/wangyingjie/Documents/code_yingjie/musicListGen/desktop/src/app/App.tsx)
- [desktop/src/components/layout/WorkspaceSidebar.tsx](/Users/wangyingjie/Documents/code_yingjie/musicListGen/desktop/src/components/layout/WorkspaceSidebar.tsx)
- [desktop/src/components/playlist/PlaylistWorkflow.tsx](/Users/wangyingjie/Documents/code_yingjie/musicListGen/desktop/src/components/playlist/PlaylistWorkflow.tsx)
- [desktop/src/styles/globals.css](/Users/wangyingjie/Documents/code_yingjie/musicListGen/desktop/src/styles/globals.css)

当前主要问题如下：

1. 页面是“多区块并列工具台”结构，注意力不集中。
2. 左侧同时展示模式切换、任务列表、历史画廊、设置入口，层级混杂。
3. 中间主区同时展示预览、结果详情、最终提示词、悬浮输入器，信息密度过高。
4. 歌曲列表和视觉提示词双大输入框并排出现，像配置系统，不像创作入口。
5. 米白暖棕配色与目标参考方向完全不一致。
6. 任务状态、历史结果、参数配置都在抢占首页核心视线。

## 3. 新版设计总原则

新版首页遵循五个原则：

1. `输入优先`：用户先表达创作意图，再逐步补细节。
2. `渐进展开`：复杂参数只在需要时出现。
3. `会话呈现`：生成过程和结果作为一次次创作回合展开。
4. `极简中性`：白底、灰阶、极少强调色。
5. `业务嵌入`：保留歌单封面业务能力，但弱化工具噪音。

## 4. 页面结构

### 4.1 顶层布局

采用两栏主结构：

```text
+----------------------+------------------------------------------------------+
| 左侧会话栏            | 中央创作区                                           |
| 280px                | max-width 1040px                                    |
|                      |                                                      |
| 品牌 / 新建创作       | 空状态：欢迎语 + 主输入器 + 灵感卡片                 |
| 搜索 / 最近会话       | 会话态：创作消息流 + 主输入器                        |
| 更多菜单             |                                                      |
+----------------------+------------------------------------------------------+
```

不再使用现在这种首页常驻三块：

- 左任务栏
- 中间预览与结果区
- 右侧详情区

### 4.2 左侧会话栏

目标形态接近 ChatGPT 侧栏，但内容改造成歌单封面工作流。

#### 顶部区域

- 品牌：`有品服务`
- 副标题：`歌单封面生成`
- 右上角：折叠/展开按钮

#### 一级主操作

- `新建创作`
- `搜索记录`

#### 最近会话列表

会话项示例：

- 雨夜独立乐队封面
- 复古 disco 女声歌单
- 夏日海风电子氛围

每条会话代表一轮创作草稿或历史生成上下文，不再直接显示任务卡。

#### 更多菜单

收纳低频入口：

- 作品库
- 参数预设
- 后端状态
- 设置
- 操作日志

### 4.3 中央创作区

中央区域分两种状态。

#### 空状态

适用于新建创作、无历史会话时。

结构如下：

```text
                    这次想做什么歌单封面？

        +------------------------------------------------------+
        | 描述风格、氛围、歌单主题，或上传参考图开始          |
        |                                                      |
        | +  图片  歌单  艺名  更多参数              模式  生成 |
        +------------------------------------------------------+

        灵感浏览
        [上传照片] [霓虹都市] [Lo-fi 胶片] [最近作品] [人物贴纸]
```

#### 会话状态

适用于已经产生结果或存在本轮输入历史时。

结构如下：

```text
                 [用户输入卡片]

                 [系统生成中卡片 / 成功结果卡片]

                 [继续追问 / 再次生成 / 替换风格]

        +------------------------------------------------------+
        | 继续描述你想微调的方向                              |
        | + 图片  歌单  艺名  更多参数              模式  生成 |
        +------------------------------------------------------+
```

## 5. 核心交互模型

### 5.1 创作回合模型

每次生成都是一个 `Turn`：

1. 用户输入创作意图
2. 系统将本轮使用的结构化信息汇总为请求
3. 系统显示生成中状态
4. 返回结果图与摘要信息
5. 用户继续追调，形成下一轮

因此首页心智从“填写表单 -> 看结果”切换为“发起创作回合 -> 接收结果 -> 继续收敛”。

### 5.2 输入器模型

输入器是首页的绝对核心，视觉级别最高。

#### 结构

1. 主文本区：输入视觉描述、风格、主题
2. 左下工具位：上传图片、附加素材
3. 中部能力位：歌单、艺名、更多参数
4. 右下提交位：模式选择、生成按钮

#### 交互规则

1. 用户可以只输入一句自然语言就发起创作。
2. 如果未填写歌曲列表，允许先用纯风格描述起稿。
3. 点 `歌单` 后展开歌曲列表抽屉。
4. 点 `艺名` 后展开标题/艺名小面板。
5. 点 `更多参数` 后展开模型、尺寸、质量等高级项。
6. 上传图片后，缩略图以内联 chip 形式挂在输入器上边缘。

### 5.3 结果卡模型

每个成功结果在消息流里以结果卡出现。

#### 卡片内容

- 大图预览
- 标题：本轮创作名称
- 状态：成功 / 生成中 / 失败
- 摘要标签：模型、尺寸、素材数、歌曲数
- 操作按钮：
  - 保存图片
  - 复制提示词
  - 再次生成
  - 设为参考图

#### 生成中卡

- 显示轻量进度条
- 显示文案：`正在生成歌单封面...`
- 显示已等待时间
- 不再单独占据右下角 dock

## 6. 信息架构调整

### 6.1 首页保留内容

首页只保留以下高频内容：

1. 会话列表
2. 主输入器
3. 灵感卡片
4. 会话结果流

### 6.2 首页移除内容

以下内容不再首页常驻：

1. 右侧大参数面板
2. 右下任务浮动面板
3. 左侧任务队列和历史画廊双列表
4. 大段最终提示词只读面板
5. 大块结果详情侧栏

### 6.3 二级入口内容

以下内容迁移为二级层级：

1. 作品库
2. 操作日志
3. 高级参数
4. 后端状态
5. API 配置

## 7. 组件拆分方案

建议基于现有 React 结构拆成以下组件。

### 7.1 新增组件

#### `desktop/src/components/chat/ChatSidebar.tsx`

职责：

- 品牌区域
- 新建创作
- 搜索入口
- 最近会话列表
- 更多菜单

#### `desktop/src/components/chat/ComposerBar.tsx`

职责：

- 主输入 textarea
- 图片上传入口
- 歌单入口
- 艺名入口
- 参数入口
- 模式与发送按钮

#### `desktop/src/components/chat/SessionTimeline.tsx`

职责：

- 渲染整个消息流
- 区分用户输入卡、系统结果卡、运行中卡、失败卡

#### `desktop/src/components/chat/TurnSummaryCard.tsx`

职责：

- 展示一轮输入摘要
- 显示本轮歌曲数、素材数、艺名等

#### `desktop/src/components/chat/GenerationResultCard.tsx`

职责：

- 展示生成结果
- 提供保存、复制提示词、再次生成、设为参考图操作

#### `desktop/src/components/chat/InspirationShelf.tsx`

职责：

- 横向灵感卡片区
- 混合模板、最近作品、上传入口

#### `desktop/src/components/chat/ComposerPanels.tsx`

职责：

- 歌单抽屉
- 艺名 popover
- 更多参数面板
- 素材缩略列表

### 7.2 复用但重构的组件

#### `PlaylistWorkflow.tsx`

改为页面编排组件，不再自己承担全部业务与显示逻辑。

保留职责：

- 本地草稿状态
- 提交生成任务
- 组织当前回合数据

移出职责：

- 大面积布局和视觉结构
- 结果侧栏
- 顶部悬浮 composer 的复杂布局

#### `WorkspaceSidebar.tsx`

建议废弃当前实现，拆分为新的 `ChatSidebar.tsx`。

#### `ParameterPanel.tsx`

不再作为常驻右栏，改造成 `AdvancedOptionsPanel.tsx` 或集成进 `ComposerPanels.tsx`。

#### `TaskDock.tsx`

不再单独存在，功能并入 `SessionTimeline.tsx`。

## 8. 页面线框

### 8.1 空状态线框

```text
+----------------------------+------------------------------------------------------+
| 有品服务                   |                                                      |
| 歌单封面生成               |                                                      |
|                            |                这次想做什么歌单封面？                |
| [新建创作]                 |                                                      |
| [搜索记录]                 |      +------------------------------------------+    |
|                            |      | 描述风格、主题、氛围，或贴入一段歌单      |    |
| 最近                        |      |                                          |    |
| 雨夜独立乐队                |      | + 图片  歌单  艺名  更多参数       标准 生成 |    |
| 复古电子霓虹                |      +------------------------------------------+    |
| 清晨爵士胶片                |                                                      |
|                            |      灵感浏览                                       |
| 更多                        |      [上传照片] [城市夜色] [Lo-fi] [人物贴纸]       |
| 作品库 设置                |                                                      |
+----------------------------+------------------------------------------------------+
```

### 8.2 会话状态线框

```text
+----------------------------+------------------------------------------------------+
| 左侧会话列表                |                    [用户输入摘要卡]                  |
|                            |                                                      |
|                            |                    [生成中结果卡]                    |
|                            |                                                      |
|                            |                    [成功结果卡 + 图片]               |
|                            |                                                      |
|                            |      +------------------------------------------+    |
|                            |      | 继续补充你想调整的方向                    |    |
|                            |      | + 图片  歌单  艺名  更多参数       标准 生成 |    |
|                            |      +------------------------------------------+    |
+----------------------------+------------------------------------------------------+
```

## 9. 视觉规范

### 9.1 风格关键词

- 极简
- 轻桌面感
- 高留白
- 中性色
- 精准边框
- 低装饰
- 微弱层次

### 9.2 色彩 Token

建议整体改成白底灰阶体系，仅保留一个蓝色操作强调和一个绿色成功色。

```css
:root {
  --bg-app: #ffffff;
  --bg-sidebar: #f9f9f9;
  --bg-surface: #ffffff;
  --bg-surface-soft: #f7f7f8;
  --bg-hover: #f3f4f6;
  --bg-active: #eceef1;

  --border-soft: #e5e7eb;
  --border-default: #d9dde3;
  --border-strong: #c7ccd4;

  --text-primary: #111111;
  --text-secondary: #5f6368;
  --text-muted: #8b9198;
  --text-placeholder: #a1a7ae;

  --accent-primary: #111111;
  --accent-link: #2f7bf6;
  --accent-success: #10a37f;
  --accent-warning: #b7791f;
  --accent-error: #d14343;

  --shadow-composer: 0 8px 30px rgba(15, 23, 42, 0.08);
  --shadow-card: 0 2px 10px rgba(15, 23, 42, 0.04);
  --shadow-popover: 0 18px 48px rgba(15, 23, 42, 0.12);
}
```

### 9.3 字体建议

建议：

- 西文主字体：`Instrument Sans`
- 中文回退：`PingFang SC`, `Hiragino Sans GB`, `Microsoft YaHei`, `sans-serif`
- 数字/状态：可沿用同一套字体，不必额外引入展示字体

原因：

- ChatGPT 风格的关键不在强个性字体，而在克制、平衡、轻量。
- 当前 `Iowan Old Style` 的编辑感和旧报刊气质不适合新版方向。

### 9.4 圆角与描边

- 侧栏按钮圆角：`12px`
- composer 圆角：`28px`
- 结果卡圆角：`22px`
- 灵感卡片圆角：`24px`
- 细描边统一使用 `1px solid var(--border-soft)`

### 9.5 阴影策略

新版不使用重玻璃态。

规则：

1. composer 有最明显的阴影
2. 普通卡片只用极淡阴影
3. 侧栏基本无阴影，靠底色区分
4. 不再使用当前强烈的面板阴影和暖色雾化背景

## 10. 动效规范

### 10.1 页面级

- 首屏内容进入：`opacity 0 -> 1`，`translateY(12px) -> 0`
- 时长：`180ms`
- 缓动：`cubic-bezier(0.2, 0.8, 0.2, 1)`

### 10.2 输入器

- hover：边框加深
- focus：增加轻微阴影和外环
- submit：按钮进入 loading 态，文案从 `生成` 切换为 `生成中`

### 10.3 卡片

- hover 只改背景与边框，不做明显位移
- 结果图 hover 可轻微显示底部操作栏

## 11. 文案建议

### 11.1 空状态主文案

可选方案 A：

`这次想做什么歌单封面？`

可选方案 B：

`描述一下你的歌单气质，我们来先出第一版封面。`

建议首页主文案用方案 A，更短，更接近参考体验。

### 11.2 输入框占位文案

推荐：

`描述风格、氛围、歌单主题，或上传参考图开始`

### 11.3 歌单抽屉占位文案

`每行一首歌，支持“歌手 - 歌名”格式`

### 11.4 艺名输入占位文案

`例如：午夜回声 / 夏日晚风 / YJ Playlist`

### 11.5 生成中状态文案

- `正在生成歌单封面...`
- `已提交，正在等待图片结果返回`
- `这轮大概会花一点时间，结果出来后会留在当前会话里`

## 12. 与当前代码的映射方案

### 12.1 App 层

[desktop/src/app/App.tsx](/Users/wangyingjie/Documents/code_yingjie/musicListGen/desktop/src/app/App.tsx)

调整建议：

1. `activeView` 从多页面切换，收敛为 `home / library / settings / logs` 级别。
2. `mode` 继续保留 `text / edit`，但放入 composer 的轻量模式菜单。
3. 首页主路由只挂载新的会话式工作台。

### 12.2 Sidebar 层

[desktop/src/components/layout/WorkspaceSidebar.tsx](/Users/wangyingjie/Documents/code_yingjie/musicListGen/desktop/src/components/layout/WorkspaceSidebar.tsx)

调整建议：

1. 删除“任务队列”和“历史画廊”双区块结构。
2. 改成会话列表结构。
3. 任务数量改为小角标，不作为主体信息。

### 12.3 Workflow 层

[desktop/src/components/playlist/PlaylistWorkflow.tsx](/Users/wangyingjie/Documents/code_yingjie/musicListGen/desktop/src/components/playlist/PlaylistWorkflow.tsx)

建议拆分为：

1. `usePlaylistDraftState`
2. `ComposerBar`
3. `SessionTimeline`
4. `InspirationShelf`

这能把当前超大组件拆回清晰边界。

### 12.4 样式层

[desktop/src/styles/globals.css](/Users/wangyingjie/Documents/code_yingjie/musicListGen/desktop/src/styles/globals.css)

必须重做：

1. 根 token
2. 布局骨架
3. 侧栏样式
4. composer 样式
5. 结果卡样式

以下旧视觉建议整体退场：

1. 暖棕色背景云雾
2. 大面积玻璃拟态
3. serif 字体体系
4. 高密度面板式信息块

## 13. 数据与状态建议

为了支撑“会话式”界面，建议在前端新增 `ConversationDraft` 概念。

### 13.1 会话草稿结构

```ts
interface ConversationDraft {
  id: string;
  title: string;
  mode: "text" | "edit";
  visualPrompt: string;
  songList: string;
  artistName: string;
  mustHave: string;
  avoid: string;
  uploads: UploadAsset[];
  linkedTaskIds: string[];
  updatedAt: string;
}
```

### 13.2 为什么需要它

因为新版左侧展示的是“会话”，不是原始任务。

任务是后端异步执行实体，会话是前端创作上下文实体。两者不应该再混为一谈。

## 14. 首版实施顺序

### Phase 1：骨架替换

1. 重写全局 token
2. 替换左侧栏为会话栏
3. 清掉首页三栏式视觉

### Phase 2：输入器重构

1. 上线新的 `ComposerBar`
2. 歌单、艺名、参数改为按需展开
3. 上传图片改为 chip 化展示

### Phase 3：结果流重构

1. 上线 `SessionTimeline`
2. 结果区卡片化
3. 任务状态并入结果流

### Phase 4：二级能力迁移

1. 作品库页面
2. 设置页
3. 日志页
4. 后端状态页

## 15. V1 成功标准

如果做到以下几点，就说明这次重构是成功的：

1. 用户打开首页后第一眼只会注意到输入框。
2. 页面看起来更像“创作入口”，而不是“参数后台”。
3. 用户可以不填满所有字段也能开始第一轮生成。
4. 左侧信息明显更轻，历史上下文更像聊天会话。
5. 结果展示更自然，生成中的等待不再打断整体布局。
6. 即使不看说明，用户也能理解“先描述，再生成，再微调”的节奏。

## 16. 下一步落地建议

下一步直接进入开发时，建议按下面顺序改文件：

1. [desktop/src/styles/globals.css](/Users/wangyingjie/Documents/code_yingjie/musicListGen/desktop/src/styles/globals.css)
2. [desktop/src/app/App.tsx](/Users/wangyingjie/Documents/code_yingjie/musicListGen/desktop/src/app/App.tsx)
3. [desktop/src/components/layout/WorkspaceSidebar.tsx](/Users/wangyingjie/Documents/code_yingjie/musicListGen/desktop/src/components/layout/WorkspaceSidebar.tsx)
4. [desktop/src/components/playlist/PlaylistWorkflow.tsx](/Users/wangyingjie/Documents/code_yingjie/musicListGen/desktop/src/components/playlist/PlaylistWorkflow.tsx)
5. 新建 `desktop/src/components/chat/` 目录承载会话化组件

如果继续推进实现，推荐先完成一个只覆盖 `歌单生成` 模式的首页 V1，再把 `图生图` 平移到同一套界面语言中。
