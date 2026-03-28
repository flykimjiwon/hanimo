/**
 * Multi-Endpoint Manager
 * - Discovers models from multiple endpoints
 * - Shows which endpoint each model comes from
 * - Handles duplicate models across endpoints (priority-based or round-robin)
 */

import type { Endpoint } from '../config/schema.js';

export interface EndpointModel {
  modelId: string;
  endpointName: string;
  endpointURL: string;
  provider: string;
  apiKey?: string;
  priority: number;
}

export interface ModelGroup {
  modelId: string;
  endpoints: EndpointModel[];
  /** Currently selected endpoint index (for round-robin) */
  currentIndex: number;
}

export class EndpointManager {
  private groups = new Map<string, ModelGroup>();
  private endpoints: Endpoint[] = [];

  async loadEndpoints(endpoints: Endpoint[]): Promise<void> {
    this.endpoints = endpoints.filter(e => e.enabled);
    this.groups.clear();

    // Discover models from all endpoints in parallel
    const results = await Promise.allSettled(
      this.endpoints.map(ep => this.discoverFromEndpoint(ep)),
    );

    for (const result of results) {
      if (result.status === 'fulfilled') {
        for (const model of result.value) {
          this.addModel(model);
        }
      }
    }
  }

  private async discoverFromEndpoint(endpoint: Endpoint): Promise<EndpointModel[]> {
    const models: EndpointModel[] = [];

    try {
      if (endpoint.provider === 'ollama') {
        // Ollama: /api/tags
        const resp = await fetch(`${endpoint.baseURL}/api/tags`, {
          signal: AbortSignal.timeout(5000),
        });
        if (!resp.ok) return [];
        const data = await resp.json() as { models?: Array<{ name: string }> };
        for (const m of data.models ?? []) {
          models.push({
            modelId: m.name,
            endpointName: endpoint.name,
            endpointURL: endpoint.baseURL,
            provider: endpoint.provider,
            apiKey: endpoint.apiKey,
            priority: endpoint.priority,
          });
        }
      } else {
        // OpenAI-compatible: /v1/models
        const headers: Record<string, string> = { Accept: 'application/json' };
        if (endpoint.apiKey) headers['Authorization'] = `Bearer ${endpoint.apiKey}`;

        const url = endpoint.baseURL.endsWith('/v1')
          ? `${endpoint.baseURL}/models`
          : `${endpoint.baseURL}/v1/models`;

        const resp = await fetch(url, {
          headers,
          signal: AbortSignal.timeout(5000),
        });
        if (!resp.ok) return [];
        const data = await resp.json() as { data?: Array<{ id: string }> };
        for (const m of data.data ?? []) {
          models.push({
            modelId: m.id,
            endpointName: endpoint.name,
            endpointURL: endpoint.baseURL,
            provider: endpoint.provider,
            apiKey: endpoint.apiKey,
            priority: endpoint.priority,
          });
        }
      }
    } catch {
      // Endpoint unreachable — skip silently
    }

    return models;
  }

  private addModel(model: EndpointModel): void {
    const existing = this.groups.get(model.modelId);
    if (existing) {
      existing.endpoints.push(model);
      // Sort by priority descending
      existing.endpoints.sort((a, b) => b.priority - a.priority);
    } else {
      this.groups.set(model.modelId, {
        modelId: model.modelId,
        endpoints: [model],
        currentIndex: 0,
      });
    }
  }

  /**
   * Get all unique model IDs with their endpoint info
   */
  getAllModels(): Array<{ modelId: string; endpoints: string[]; endpointCount: number }> {
    return Array.from(this.groups.values())
      .map(g => ({
        modelId: g.modelId,
        endpoints: g.endpoints.map(e => e.endpointName),
        endpointCount: g.endpoints.length,
      }))
      .sort((a, b) => a.modelId.localeCompare(b.modelId));
  }

  /**
   * Get the best endpoint for a model.
   * - Single endpoint: returns it directly
   * - Multiple endpoints: round-robin (rotates on each call)
   */
  getEndpoint(modelId: string): EndpointModel | undefined {
    const group = this.groups.get(modelId);
    if (!group || group.endpoints.length === 0) return undefined;

    if (group.endpoints.length === 1) {
      return group.endpoints[0];
    }

    // Round-robin: rotate to next endpoint
    const endpoint = group.endpoints[group.currentIndex];
    group.currentIndex = (group.currentIndex + 1) % group.endpoints.length;
    return endpoint;
  }

  /**
   * Get all endpoints for a model (for user selection)
   */
  getEndpointsForModel(modelId: string): EndpointModel[] {
    return this.groups.get(modelId)?.endpoints ?? [];
  }

  /**
   * Check if any endpoints are loaded
   */
  hasEndpoints(): boolean {
    return this.endpoints.length > 0;
  }

  /**
   * Get summary for display
   */
  getSummary(): string {
    const totalEndpoints = this.endpoints.length;
    const totalModels = this.groups.size;
    const duplicates = Array.from(this.groups.values()).filter(g => g.endpoints.length > 1);
    return `${totalEndpoints} endpoints, ${totalModels} models${duplicates.length > 0 ? `, ${duplicates.length} shared (round-robin)` : ''}`;
  }
}
