import { open } from "@tauri-apps/plugin-dialog";
import { readTextFile, writeTextFile, readDir } from "@tauri-apps/plugin-fs";
import { getLanguageFromPath, useEditorStore } from "../stores/editor-store";

export interface FileEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  children?: FileEntry[];
}

export function useFileSystem() {
  const { openFile, markSaved, setProjectRoot } = useEditorStore();

  async function openFolder(): Promise<string | null> {
    const selected = await open({ directory: true, multiple: false });
    if (!selected || Array.isArray(selected)) return null;
    setProjectRoot(selected);
    return selected;
  }

  async function listDirectory(dirPath: string): Promise<FileEntry[]> {
    const entries = await readDir(dirPath);
    const result: FileEntry[] = entries
      .filter((e) => {
        const name = e.name ?? "";
        return !name.startsWith(".") && name !== "node_modules";
      })
      .map((e) => ({
        name: e.name ?? "",
        path: dirPath + "/" + (e.name ?? ""),
        isDirectory: !!e.isDirectory,
      }));

    result.sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) {
        return a.isDirectory ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });

    return result;
  }

  async function openFileFromPath(filePath: string): Promise<void> {
    const content = await readTextFile(filePath);
    const name = filePath.split("/").pop() ?? filePath;
    const language = getLanguageFromPath(filePath);
    openFile({ path: filePath, name, content, language, isDirty: false });
  }

  async function saveFile(filePath: string, content: string): Promise<void> {
    await writeTextFile(filePath, content);
    markSaved(filePath);
  }

  return { openFolder, listDirectory, openFileFromPath, saveFile };
}
