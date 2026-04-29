import { create } from "zustand";

import { visualPrompts } from "../data/visualPrompts";

const PLAYLIST_DRAFT_KEY = "music-list-gen-playlist-draft-v1";
const defaultSongList = ["告五人 - 爱人错过", "陈绮贞 - 旅行的意义", "Deca Joins - 海浪"].join("\n");

interface PlaylistDraftState {
  promptPresetId: string;
  visualPrompt: string;
  artistName: string;
  songList: string;
  mustHave: string;
  avoid: string;
  temperature: number;
  setPromptPresetId: (promptPresetId: string) => void;
  setVisualPrompt: (visualPrompt: string) => void;
  setArtistName: (artistName: string) => void;
  setSongList: (songList: string) => void;
  setMustHave: (mustHave: string) => void;
  setAvoid: (avoid: string) => void;
  setTemperature: (temperature: number) => void;
  resetDraft: () => void;
}

interface StoredPlaylistDraft {
  promptPresetId?: string;
  visualPrompt?: string;
  artistName?: string;
  songList?: string;
  mustHave?: string;
  avoid?: string;
  temperature?: number;
}

const defaultPreset = visualPrompts[0];
const storedDraft = loadStoredDraft();

export const usePlaylistDraftStore = create<PlaylistDraftState>((set) => ({
  promptPresetId: storedDraft.promptPresetId || defaultPreset.id,
  visualPrompt: storedDraft.visualPrompt || defaultPreset.text,
  artistName: storedDraft.artistName || "",
  songList: storedDraft.songList || defaultSongList,
  mustHave: storedDraft.mustHave || "",
  avoid: storedDraft.avoid || "",
  temperature: typeof storedDraft.temperature === "number" ? storedDraft.temperature : 0.8,
  setPromptPresetId: (promptPresetId) => {
    persistStoredDraft({ promptPresetId });
    set({ promptPresetId });
  },
  setVisualPrompt: (visualPrompt) => {
    persistStoredDraft({ visualPrompt });
    set({ visualPrompt });
  },
  setArtistName: (artistName) => {
    persistStoredDraft({ artistName });
    set({ artistName });
  },
  setSongList: (songList) => {
    persistStoredDraft({ songList });
    set({ songList });
  },
  setMustHave: (mustHave) => {
    persistStoredDraft({ mustHave });
    set({ mustHave });
  },
  setAvoid: (avoid) => {
    persistStoredDraft({ avoid });
    set({ avoid });
  },
  setTemperature: (temperature) => {
    persistStoredDraft({ temperature });
    set({ temperature });
  },
  resetDraft: () => {
    const nextDraft: StoredPlaylistDraft = {
      promptPresetId: defaultPreset.id,
      visualPrompt: defaultPreset.text,
      artistName: "",
      songList: defaultSongList,
      mustHave: "",
      avoid: "",
      temperature: 0.8
    };
    persistStoredDraft(nextDraft);
    set(nextDraft as PlaylistDraftState);
  }
}));

function loadStoredDraft(): StoredPlaylistDraft {
  if (typeof window === "undefined") {
    return {};
  }
  try {
    const raw = window.localStorage.getItem(PLAYLIST_DRAFT_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function persistStoredDraft(patch: StoredPlaylistDraft): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    const current = loadStoredDraft();
    window.localStorage.setItem(PLAYLIST_DRAFT_KEY, JSON.stringify({ ...current, ...patch }));
  } catch {
    // 草稿写入失败不阻断当前编辑。
  }
}
