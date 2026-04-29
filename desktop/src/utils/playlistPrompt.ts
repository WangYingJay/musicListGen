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
    .map((line) => line.trim())
    .filter(Boolean)
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
    songList ? `固定歌曲列表：\n${songList}` : "",
    input.mustHave.trim() ? `画面必须包含：${input.mustHave.trim()}` : "",
    input.avoid.trim() ? `画面避免出现：${input.avoid.trim()}` : "",
    "排序要求：歌曲列表展示时按每行文本长度从短到长排序，不改变歌曲内容，只调整展示顺序。",
    `图片尺寸：${input.imageSize}。风格发散度：${input.temperature}，${styleStrength}。`,
    input.hasAvatar ? "已上传头像：请把头像作为人物、艺人形象或角色气质参考，尽量保留身份特征。" : "",
    input.hasReferenceImages ? "已上传参考图：请参考其构图、色彩、氛围和视觉风格。" : "",
    input.hasMaterialImages ? "已上传素材图：请把素材中的主体、场景或物件融入画面。" : "",
    "文字与版式要求：这是歌单列表图，需要明确的标题区、艺名区和歌曲列表区。整张图只能有一个主标题焦点，不要把艺名重复做成两个大标题，不要出现相同文字的重复放大。歌曲列表应完整、分行清晰、层级分明、便于阅读，不要显示序号，不要用边框、表格线、卡片框或描边容器把歌曲列表栏框起来，可通过对齐、字重、留白和轻量分隔提升设计感。",
    "排版硬性约束：所有文字都必须完整落在画布内，任何标题、艺名、歌曲名、辅助文案都不能超出左右边缘、上边缘或下边缘，不能被裁切，不能只露半行，不能出现最后一个字被截断。",
    "安全边距要求：整套文字必须放进统一版芯，文字距离画布四周至少保留 8% 到 12% 的安全边距，尤其左右两侧和底部必须留白更足，避免最后一列、最长歌名或最后几行贴边。",
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
