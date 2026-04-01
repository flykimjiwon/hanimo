import { useEditorStore } from "../../stores/editor-store";
import { useThemeStore } from "../../stores/theme-store";

export function TabBar() {
  const { openFiles, activeFilePath, setActiveFile, closeFile } = useEditorStore();
  const { theme } = useThemeStore();
  const c = theme.colors;

  return (
    <div
      className="flex items-center flex-shrink-0 overflow-x-auto"
      style={{ height: 36, background: c.tabBg, borderBottom: `1px solid ${c.border}` }}
    >
      {openFiles.map((file) => {
        const isActive = file.path === activeFilePath;
        return (
          <div
            key={file.path}
            className="flex items-center gap-1.5 px-3 flex-shrink-0 cursor-pointer select-none text-sm"
            style={{
              height: 36,
              background: isActive ? c.tabActiveBg : "transparent",
              color: isActive ? c.text : c.textSecondary,
              borderBottom: isActive ? `2px solid ${c.accent}` : "2px solid transparent",
            }}
            onClick={() => setActiveFile(file.path)}
          >
            {file.isDirty && (
              <span style={{ color: c.accent, fontSize: 10 }}>●</span>
            )}
            <span>{file.name}</span>
            <button
              className="flex items-center justify-center rounded hover:opacity-100 opacity-50"
              style={{ width: 16, height: 16, fontSize: 11 }}
              onClick={(e) => {
                e.stopPropagation();
                closeFile(file.path);
              }}
            >
              ✕
            </button>
          </div>
        );
      })}
    </div>
  );
}
