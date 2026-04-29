import type { GenerateInput } from "../types";

export interface PlaylistPromptInput {
  visualPrompt: string;
  artistName: string;
  songList: string;
  mustHave: string;
  avoid: string;
  temperature: number;
  imageSize: string;
  hasAvatar: boolean;
  hasReferenceImages: boolean;
  hasMaterialImages: boolean;
}

export function cleanSongList(songList: string): string {
  return songList
    .split("\n")
    .map((line) =>
      line
        .trim()
        // 用户常会直接粘贴带编号的歌单，这里先去掉显式序号，避免模型把编号当成正文渲染出来。
        .replace(/^(?:\(?\d+\)?[.)、:：\-]\s*|[（(]\d+[）)]\s*|[一二三四五六七八九十]+\s*[、.．]\s*)/, "")
        .trim()
    )
    .filter(Boolean)
    .map((line, index) => ({
      line,
      index,
      // 按可见字数做稳定升序，同字数保留原始相对顺序，避免模型二次改序破坏版式节奏。
      length: Array.from(line.replace(/\s+/g, "")).length
    }))
    .sort((left, right) => left.length - right.length || left.index - right.index)
    .map(({ line }) => line)
    .join("\n");
}

export function buildTitleSafetyRule(): string {
  // 只约束模型额外生成的标题，不改变用户输入的固定歌曲名。
  return "标题合规要求：如果画面里需要额外生成歌单标题，标题必须安全、中性、平台友好，不得出现低俗、擦边、性暗示或其他平台违禁词；标题严禁出现“色”字。固定歌曲列表中的歌名不受这条限制，哪怕歌名里包含“色”字也必须原样保留，不要为了规避而改歌名。若对标题措辞没有把握，可以不额外生成歌单标题，只保留艺名和歌曲列表。";
}

export function buildPlaylistPrompt(input: PlaylistPromptInput): string {
  const songList = cleanSongList(input.songList);
  const styleStrength =
    input.temperature >= 0.9
      ? "可以更有想象力和视觉张力"
      : input.temperature <= 0.3
        ? "保持克制、清晰、贴近输入"
        : "在准确表达歌单情绪的基础上适度发挥";

  return [
    "任务：根据用户提供的固定歌曲列表生成一张歌单列表图片或分享海报，不是单纯封面图。",
    "重点：把歌曲列表作为画面主体清晰排版出来，不要重新生成歌曲，不要替换歌曲名，不要遗漏歌曲。",
    `视觉风格提示（最高优先级）：${input.visualPrompt.trim()}`,
    input.artistName.trim()
      ? `歌手艺名：${input.artistName.trim()}。如画面需要文字，优先展示这个艺名，可与歌单标题一起形成主标题区域。艺名只能出现一次，不要重复书写，不要做两个相同内容的超大字号标题。`
      : "",
    buildTitleSafetyRule(),
    songList ? `固定歌曲列表（已按歌名字数从短到长稳定排序，最终排版时必须严格保持这个顺序）：\n${songList}` : "",
    input.mustHave.trim() ? `画面必须包含：${input.mustHave.trim()}` : "",
    input.avoid.trim() ? `画面避免出现：${input.avoid.trim()}` : "",
    "排序硬约束：歌曲列表顺序非常重要，会直接影响整体观感和视觉节奏。最终画面必须严格按照上方列表从上到下排版，不得自行改序、插队、分组重排或随机调整；如果字数相同，保持当前相对顺序。",
    `图片尺寸：${input.imageSize}。风格发散度：${input.temperature}，${styleStrength}。`,
    input.hasAvatar ? "已上传头像：请把头像作为人物、艺人形象或角色气质参考，尽量保留身份特征。" : "",
    input.hasReferenceImages ? "已上传参考图：请参考其构图、色彩、氛围和视觉风格。" : "",
    input.hasMaterialImages ? "已上传素材图：请把素材中的主体、场景或物件融入画面。" : "",
    "文字与版式要求：这是歌单列表图，需要明确的标题区、艺名区和歌曲列表区。整张图只能有一个主标题焦点，不要把艺名重复做成两个大标题，不要出现相同文字的重复放大。歌曲列表应完整、分行清晰、层级分明、便于阅读，不要用边框、表格线、卡片框或描边容器把歌曲列表栏框起来，可通过对齐、字重、留白和轻量分隔提升设计感。",
    "歌曲序号约束：最终画面里的歌曲列表只显示歌名本身，不要显示阿拉伯数字序号、中文序号、项目符号、勾选框或任何列表编号；即使原始输入里带了 1.、01、1、 这类前缀，也必须去掉后再排版。",
    "排版硬性约束：所有文字都必须完整落在画布内，任何标题、艺名、歌曲名、辅助文案都不能超出左右边缘、上边缘或下边缘，不能被裁切，不能只露半行，不能出现最后一个字被截断。",
    "安全边距硬约束：安全边距非常重要，优先级高于装饰效果和局部构图。整套文字必须放进统一版芯，文字距离画布四周至少保留 10% 到 12% 的安全边距，尤其左右两侧和底部必须留白更足；宁可缩小字号、减少装饰、压缩背景主体，也不能让最后一列、最长歌名或最后几行贴边。",
    "长文本处理要求：如果某一行歌名偏长，优先自动缩小字号、增加行高、适度收窄字重、必要时做自然换行；宁可减少装饰元素、缩小标题或扩大留白，也不要让歌曲列表挤出边缘。",
    "画面要求：背景和人物服务于文字阅读，不要喧宾夺主，不要遮挡歌曲列表。允许较高比例的文字内容，但必须保持整体美感和海报感。",
    "避免出现：水印、平台 logo、乱码、错别字、错误歌名、畸形五官、低清噪点、过度装饰、文字难以辨认。"
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function buildPlaylistGenerateInput(params: GenerateInput, prompt: string, size: string, quality: GenerateInput["quality"]): GenerateInput {
  return {
    ...params,
    prompt,
    size,
    quality,
    n: 1
  };
}
