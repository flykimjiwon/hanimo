import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import type { ToolSet } from 'ai';
import { tool } from 'ai';
import { z } from 'zod';
import type { McpServerConfig } from '../config/schema.js';

export class McpClient {
  private client: Client;
  private transport: Transport | null = null;
  private connected = false;

  constructor(name: string) {
    this.client = new Client({ name, version: '1.0.0' });
  }

  async connect(config: McpServerConfig): Promise<void> {
    if (config.command) {
      this.transport = new StdioClientTransport({
        command: config.command,
        args: config.args,
        env: config.env,
      });
    } else if (config.url) {
      this.transport = new SSEClientTransport(new URL(config.url), {
        requestInit: config.headers
          ? { headers: config.headers }
          : undefined,
      });
    } else {
      throw new Error(
        `McpServerConfig for "${config.name}" must have either command or url`
      );
    }

    const connectTimeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('MCP server connection timed out after 10s')), 10000)
    );
    await Promise.race([this.client.connect(this.transport), connectTimeout]);
    this.connected = true;
  }

  async listTools(): Promise<
    Array<{ name: string; description?: string; inputSchema?: unknown }>
  > {
    const result = await this.client.listTools();
    return result.tools.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    }));
  }

  async callTool(
    name: string,
    args: Record<string, unknown>
  ): Promise<unknown> {
    const result = await this.client.callTool({ name, arguments: args });
    return result;
  }

  toToolSet(): ToolSet {
    // We return an empty tool set synchronously; callers should call
    // buildToolSet() after connecting to get the populated set.
    return {};
  }

  async buildToolSet(): Promise<ToolSet> {
    const tools = await this.listTools();
    const toolSet: ToolSet = {};

    for (const mcpTool of tools) {
      const toolName = mcpTool.name;
      const toolDescription = mcpTool.description;

      // Use z.object({}).passthrough() as a safe fallback for dynamic MCP schemas
      toolSet[toolName] = tool({
        description: toolDescription,
        parameters: z.object({}).passthrough(),
        execute: async (args: Record<string, unknown>) => {
          return this.callTool(toolName, args);
        },
      });
    }

    return toolSet;
  }

  async disconnect(): Promise<void> {
    if (this.transport && this.connected) {
      await this.transport.close();
      this.connected = false;
      this.transport = null;
    }
  }

  isConnected(): boolean {
    return this.connected;
  }
}
