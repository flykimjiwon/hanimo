# Open Questions

## vscode-extension - 2026-03-27

- [ ] Should the monorepo migration happen in-place (rename directories) or as a fresh repo with git history preserved via filter-branch? — Affects git blame continuity and PR history
- [ ] Which Ollama model should be the default when no model is configured? (e.g., `qwen3:8b` vs `llama3.1:8b`) — First-run experience depends on a model that most users will have pulled
- [ ] Should the extension auto-detect a running Ollama instance and pre-populate the model list? — UX polish vs implementation complexity tradeoff
- [ ] The current `@modol/core` exports use `.js` extensions in imports (ESM). esbuild bundling for VS Code extension (CJS output) needs verification that these resolve correctly — Could cause runtime errors if not tested
- [ ] Should tool execution in VS Code use the workspace root or the active file's directory as `cwd`? — The CLI uses `process.cwd()`, but VS Code has `workspaceFolders` which may be multi-root
- [ ] The `shell_exec` tool runs arbitrary commands. Should the VS Code extension add extra sandboxing beyond the existing `requireApproval` gate? — Security concern for extension review
- [ ] Should inline completions (Phase 3) share the same agent session/context as the sidebar chat, or use a separate lightweight session? — Shared context is smarter but may pollute chat history with completion requests
- [ ] Publisher name on VS Code Marketplace: `modol` or `hanimo-webui`? — Must match Azure DevOps org. Cannot be changed after creation
- [ ] Does the existing `text-mode.ts` (37K lines) need refactoring before the monorepo split, or can it move to `@modol/cli` as-is? — It may have hidden dependencies on relative paths
- [ ] Should the webview React app share any components with the existing TUI (Ink/React)? — They use different React renderers (ink vs react-dom) so sharing is limited to pure logic hooks at best
