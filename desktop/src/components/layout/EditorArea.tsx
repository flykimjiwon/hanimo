import { useThemeStore } from "../../stores/theme-store";
import { useEditorStore } from "../../stores/editor-store";
import { TabBar } from "../editor/TabBar";
import { MonacoWrapper } from "../editor/MonacoWrapper";

export function EditorArea() {
  const { theme } = useThemeStore();
  const c = theme.colors;
  const { openFiles } = useEditorStore();

  if (openFiles.length > 0) {
    return (
      <div
        className="flex flex-col flex-1 overflow-hidden"
        style={{ background: c.editorBg }}
      >
        <TabBar />
        <div className="flex-1 overflow-hidden">
          <MonacoWrapper />
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col flex-1 overflow-hidden"
      style={{ background: c.editorBg }}
    >
      <div className="flex-1 flex flex-col items-center justify-center gap-3">
        <span className="text-5xl">🐶</span>
        <p className="text-sm" style={{ color: c.textMuted }}>
          Start a conversation to begin
        </p>
      </div>
    </div>
  );
}
