import { create } from "zustand";

export interface OpenFile {
  path: string;
  name: string;
  content: string;
  language: string;
  isDirty: boolean;
}

interface EditorState {
  openFiles: OpenFile[];
  activeFilePath: string | null;
  projectRoot: string | null;
  openFile: (file: OpenFile) => void;
  closeFile: (path: string) => void;
  setActiveFile: (path: string) => void;
  updateFileContent: (path: string, content: string) => void;
  markSaved: (path: string) => void;
  setProjectRoot: (root: string) => void;
}

export function getLanguageFromPath(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    ts: "typescript",
    tsx: "typescriptreact",
    js: "javascript",
    jsx: "javascriptreact",
    json: "json",
    md: "markdown",
    css: "css",
    html: "html",
    py: "python",
    rs: "rust",
    toml: "toml",
    yaml: "yaml",
    yml: "yaml",
    sh: "shell",
    bash: "shell",
    txt: "plaintext",
  };
  return map[ext] ?? "plaintext";
}

export const useEditorStore = create<EditorState>((set) => ({
  openFiles: [],
  activeFilePath: null,
  projectRoot: null,

  openFile: (file) =>
    set((state) => {
      const exists = state.openFiles.some((f) => f.path === file.path);
      return {
        openFiles: exists ? state.openFiles : [...state.openFiles, file],
        activeFilePath: file.path,
      };
    }),

  closeFile: (path) =>
    set((state) => {
      const filtered = state.openFiles.filter((f) => f.path !== path);
      let activeFilePath = state.activeFilePath;
      if (activeFilePath === path) {
        const idx = state.openFiles.findIndex((f) => f.path === path);
        if (filtered.length === 0) {
          activeFilePath = null;
        } else {
          const newIdx = Math.min(idx, filtered.length - 1);
          activeFilePath = filtered[newIdx].path;
        }
      }
      return { openFiles: filtered, activeFilePath };
    }),

  setActiveFile: (path) => set({ activeFilePath: path }),

  updateFileContent: (path, content) =>
    set((state) => ({
      openFiles: state.openFiles.map((f) =>
        f.path === path ? { ...f, content, isDirty: true } : f
      ),
    })),

  markSaved: (path) =>
    set((state) => ({
      openFiles: state.openFiles.map((f) =>
        f.path === path ? { ...f, isDirty: false } : f
      ),
    })),

  setProjectRoot: (root) => set({ projectRoot: root }),
}));
