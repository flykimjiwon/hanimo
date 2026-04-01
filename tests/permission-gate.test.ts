import { describe, it, expect, vi } from 'vitest';
import { wrapToolsWithPermission } from '../src/core/permission-gate.js';
import { tool } from 'ai';
import { z } from 'zod';

function makeTool(name: string) {
  return tool({
    description: `Test tool: ${name}`,
    parameters: z.object({ path: z.string().optional() }),
    execute: async (args) => `executed ${name} with ${JSON.stringify(args)}`,
  });
}

describe('wrapToolsWithPermission', () => {
  it('passes through all tools when requireApproval is false', () => {
    const tools = { read_file: makeTool('read'), write_file: makeTool('write') };
    const handler = { requestApproval: vi.fn() };
    const wrapped = wrapToolsWithPermission(tools, false, handler);
    expect(wrapped).toBe(tools);
  });

  it('does not require approval for read-only tools', async () => {
    const tools = { read_file: makeTool('read'), glob_search: makeTool('glob') };
    const handler = { requestApproval: vi.fn() };
    const wrapped = wrapToolsWithPermission(tools, true, handler);
    // Read-only tools should execute without calling approval
    const rf = wrapped.read_file as unknown as { execute: (args: Record<string, unknown>) => Promise<unknown> };
    const result = await rf.execute({ path: 'test.txt' });
    expect(handler.requestApproval).not.toHaveBeenCalled();
    expect(typeof result).toBe('string');
    expect(result).toContain('executed');
  });

  it('wraps destructive tools and calls approval handler', async () => {
    const tools = { write_file: makeTool('write'), shell_exec: makeTool('shell') };
    const handler = { requestApproval: vi.fn().mockResolvedValue(true) };
    const wrapped = wrapToolsWithPermission(tools, true, handler);

    // The wrapped tool should be different from original
    expect(wrapped.write_file).not.toBe(tools.write_file);

    // Execute the wrapped tool — should call approval
    const wf = wrapped.write_file as unknown as { execute: (args: Record<string, unknown>) => Promise<unknown> };
    const result = await wf.execute({ path: 'test.txt', content: 'hello' });
    expect(handler.requestApproval).toHaveBeenCalledTimes(1);
    expect(typeof result).toBe('string');
  });

  it('returns denial message when user rejects', async () => {
    const tools = { write_file: makeTool('write') };
    const handler = { requestApproval: vi.fn().mockResolvedValue(false) };
    const wrapped = wrapToolsWithPermission(tools, true, handler);

    const wf = wrapped.write_file as unknown as { execute: (args: Record<string, unknown>) => Promise<unknown> };
    const result = await wf.execute({ path: 'secret.txt' });
    expect(result).toContain('[Permission denied]');
    expect(handler.requestApproval).toHaveBeenCalledTimes(1);
  });
});
