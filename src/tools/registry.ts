import { readFileTool, writeFileTool, editFileTool } from './file-ops.js';
import { gitStatusTool, gitDiffTool, gitCommitTool, gitLogTool } from './git-tools.js';
import { shellExecTool } from './shell-exec.js';
import { globSearchTool } from './glob-search.js';
import { grepSearchTool } from './grep-search.js';

export function createToolRegistry() {
  return {
    read_file: readFileTool,
    write_file: writeFileTool,
    edit_file: editFileTool,
    git_status: gitStatusTool,
    git_diff: gitDiffTool,
    git_commit: gitCommitTool,
    git_log: gitLogTool,
    shell_exec: shellExecTool,
    glob_search: globSearchTool,
    grep_search: grepSearchTool,
  };
}

export {
  readFileTool,
  writeFileTool,
  editFileTool,
  gitStatusTool,
  gitDiffTool,
  gitCommitTool,
  gitLogTool,
  shellExecTool,
  globSearchTool,
  grepSearchTool,
};
