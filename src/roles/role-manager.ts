import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type { RoleDefinition } from './types.js';
import { createToolSetFromList } from '../tools/registry.js';
import type { ToolSet } from 'ai';

const BUILT_IN_DIR = new URL('./built-in/', import.meta.url);

export class RoleManager {
  private roles = new Map<string, RoleDefinition>();

  constructor() {
    this.loadBuiltInRoles();
  }

  loadBuiltInRoles(): void {
    const builtInFiles = ['chat.json', 'dev.json', 'plan.json'];
    for (const file of builtInFiles) {
      try {
        const filePath = new URL(file, BUILT_IN_DIR).pathname;
        const content = readFileSync(filePath, 'utf-8');
        const role = JSON.parse(content) as RoleDefinition;
        this.roles.set(role.id, role);
      } catch {
        // Skip if file not found — should not happen for built-ins
      }
    }
  }

  async loadCustomRoles(): Promise<void> {
    const customDir = join(homedir(), '.modol', 'roles');
    let files: string[];
    try {
      files = readdirSync(customDir).filter(f => f.endsWith('.json'));
    } catch {
      return; // Directory doesn't exist — no custom roles
    }

    for (const file of files) {
      try {
        const content = readFileSync(join(customDir, file), 'utf-8');
        const role = JSON.parse(content) as RoleDefinition;
        if (role.id && role.name) {
          this.roles.set(role.id, role);
        }
      } catch {
        // Skip malformed files
      }
    }
  }

  getRole(id: string): RoleDefinition | undefined {
    return this.roles.get(id);
  }

  getAllRoles(): RoleDefinition[] {
    return Array.from(this.roles.values());
  }

  createToolSet(role: RoleDefinition): ToolSet | undefined {
    return createToolSetFromList(role.tools);
  }

  buildRolePrompt(role: RoleDefinition, basePrompt: string): string {
    if (!role.systemPrompt) return basePrompt;
    return `${basePrompt}\n\n## Active Role: ${role.icon} ${role.name}\n${role.systemPrompt}`;
  }
}
