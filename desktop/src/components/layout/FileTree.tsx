import { useState, useEffect } from "react";
import { useThemeStore } from "../../stores/theme-store";
import { useEditorStore } from "../../stores/editor-store";
import { useFileSystem, type FileEntry } from "../../hooks/use-file-system";

function FileItem({
  entry,
  depth,
  onFileClick,
  onDirToggle,
  expandedDirs,
}: {
  entry: FileEntry;
  depth: number;
  onFileClick: (path: string) => void;
  onDirToggle: (path: string) => void;
  expandedDirs: Set<string>;
}) {
  const { theme } = useThemeStore();
  const c = theme.colors;
  const isExpanded = expandedDirs.has(entry.path);

  return (
    <div>
      <div
        className="flex items-center gap-1 cursor-pointer hover:opacity-80 text-sm py-0.5"
        style={{
          paddingLeft: depth * 16 + 8,
          color: c.text,
        }}
        onClick={() =>
          entry.isDirectory ? onDirToggle(entry.path) : onFileClick(entry.path)
        }
      >
        <span style={{ fontSize: 12 }}>
          {entry.isDirectory ? (isExpanded ? "📂" : "📁") : "📄"}
        </span>
        <span className="truncate">{entry.name}</span>
      </div>
      {entry.isDirectory && isExpanded && entry.children && (
        <div>
          {entry.children.map((child) => (
            <FileItem
              key={child.path}
              entry={child}
              depth={depth + 1}
              onFileClick={onFileClick}
              onDirToggle={onDirToggle}
              expandedDirs={expandedDirs}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function FileTree() {
  const { theme } = useThemeStore();
  const c = theme.colors;
  const { projectRoot } = useEditorStore();
  const { openFolder, listDirectory, openFileFromPath } = useFileSystem();

  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (projectRoot) {
      listDirectory(projectRoot).then(setEntries).catch(console.error);
    }
  }, [projectRoot]);

  async function handleDirToggle(path: string) {
    setExpandedDirs((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });

    // Lazy load children
    if (!expandedDirs.has(path)) {
      const children = await listDirectory(path);
      setEntries((prev) => updateChildren(prev, path, children));
    }
  }

  function updateChildren(
    items: FileEntry[],
    targetPath: string,
    children: FileEntry[]
  ): FileEntry[] {
    return items.map((item) => {
      if (item.path === targetPath) {
        return { ...item, children };
      }
      if (item.children) {
        return { ...item, children: updateChildren(item.children, targetPath, children) };
      }
      return item;
    });
  }

  const dirName = projectRoot ? projectRoot.split("/").pop() : null;

  return (
    <div
      className="flex flex-col flex-shrink-0 overflow-hidden"
      style={{ width: 220, background: c.bgSecondary, borderRight: `1px solid ${c.border}` }}
    >
      <div
        className="px-3 py-2 text-xs font-semibold tracking-widest uppercase flex-shrink-0"
        style={{ color: c.textSecondary, borderBottom: `1px solid ${c.border}` }}
      >
        Explorer
      </div>

      {!projectRoot ? (
        <div className="flex-1 flex flex-col items-center justify-center px-4 gap-3">
          <p className="text-center text-sm" style={{ color: c.textMuted }}>
            Open a folder to get started
          </p>
          <button
            className="px-3 py-1.5 rounded text-sm font-medium"
            style={{ background: c.accent, color: "#fff" }}
            onClick={openFolder}
          >
            Open Folder
          </button>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto py-1">
          <div
            className="px-2 py-1 text-xs font-semibold truncate"
            style={{ color: c.textSecondary }}
          >
            {dirName}
          </div>
          {entries.map((entry) => (
            <FileItem
              key={entry.path}
              entry={entry}
              depth={0}
              onFileClick={openFileFromPath}
              onDirToggle={handleDirToggle}
              expandedDirs={expandedDirs}
            />
          ))}
        </div>
      )}
    </div>
  );
}
