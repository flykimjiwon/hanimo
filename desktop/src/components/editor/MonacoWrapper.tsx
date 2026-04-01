import { useEffect } from "react";
import Editor from "@monaco-editor/react";
import { useEditorStore } from "../../stores/editor-store";
import { useThemeStore } from "../../stores/theme-store";
import { useFileSystem } from "../../hooks/use-file-system";

export function MonacoWrapper() {
  const { openFiles, activeFilePath, updateFileContent } = useEditorStore();
  const { mode } = useThemeStore();
  const { saveFile } = useFileSystem();

  const activeFile = openFiles.find((f) => f.path === activeFilePath);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        if (activeFile) {
          saveFile(activeFile.path, activeFile.content);
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeFile, saveFile]);

  if (!activeFile) return null;

  return (
    <Editor
      key={activeFile.path}
      height="100%"
      language={activeFile.language}
      value={activeFile.content}
      theme={mode === "dark" ? "vs-dark" : "light"}
      onChange={(value) => {
        if (value !== undefined) {
          updateFileContent(activeFile.path, value);
        }
      }}
      options={{
        minimap: { enabled: false },
        fontSize: 13,
        wordWrap: "on",
        automaticLayout: true,
        padding: { top: 8 },
      }}
    />
  );
}
