export interface PlaylistPromptSummary {
  title: string;
  artistName: string;
  visualPrompt: string;
  shortPrompt: string;
  songCount: number;
  songList: string;
  songPreview: string[];
}

export function parsePlaylistPromptSummary(prompt: string): PlaylistPromptSummary {
  const lines = prompt
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const visualPrompt = readSectionValue(lines, "视觉风格提示（最高优先级）：");
  const artistRaw = readSectionValue(lines, "歌手艺名：");
  const artistName = artistRaw ? artistRaw.split("。")[0]?.trim() || artistRaw.trim() : "";
  const songLines = readSongLines(lines);
  const title = artistName || songLines[0] || shortenText(visualPrompt, 16) || "未命名创作";

  return {
    title,
    artistName,
    visualPrompt,
    shortPrompt: shortenText(visualPrompt || prompt, 56),
    songCount: songLines.length,
    songList: songLines.join("\n"),
    songPreview: songLines.slice(0, 3)
  };
}

function readSectionValue(lines: string[], prefix: string): string {
  const matchedLine = lines.find((line) => line.startsWith(prefix));
  if (!matchedLine) {
    return "";
  }
  return matchedLine.slice(prefix.length).trim();
}

function readSongLines(lines: string[]): string[] {
  const startIndex = lines.findIndex((line) => line.startsWith("固定歌曲列表"));
  if (startIndex === -1) {
    return [];
  }

  const songs: string[] = [];
  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.startsWith("排序硬约束：")) {
      break;
    }
    songs.push(line);
  }
  return songs;
}

function shortenText(text: string, maxLength: number): string {
  if (!text) {
    return "";
  }
  const normalized = text.replace(/\s+/g, " ").trim();
  const characters = Array.from(normalized);
  if (characters.length <= maxLength) {
    return normalized;
  }
  return `${characters.slice(0, maxLength).join("")}…`;
}
