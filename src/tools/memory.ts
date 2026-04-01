import { tool } from 'ai';
import { z } from 'zod';
import { writeMemory, loadMemory, readMemoryTopic, listTopics } from '../core/memory.js';

export const memoryWriteTool = tool({
  description:
    'Write information to persistent memory so it can be recalled in future sessions. ' +
    'Use a topic to organize memories by subject (e.g. "preferences", "project-notes").',
  parameters: z.object({
    content: z.string().describe('The content to store in memory'),
    topic: z.string().optional().describe('Optional topic/category for the memory (creates a separate file)'),
  }),
  execute: async ({ content, topic }) => {
    writeMemory(content, topic);
    const location = topic ? `topic "${topic}"` : 'general memory';
    return { success: true, message: `Memory saved to ${location}.` };
  },
});

export const memoryReadTool = tool({
  description:
    'Read from persistent memory. ' +
    'Actions: "read" retrieves general memory or a specific topic, "list" shows all available topics.',
  parameters: z.object({
    action: z.enum(['read', 'list']).describe('"read" to retrieve memory content, "list" to show all topics'),
    topic: z.string().optional().describe('Topic to read (for "read" action; omit to read general memory)'),
  }),
  execute: async ({ action, topic }) => {
    switch (action) {
      case 'read': {
        const content = topic ? readMemoryTopic(topic) : loadMemory();
        if (!content) {
          const label = topic ? `topic "${topic}"` : 'general memory';
          return { success: true, content: '', message: `No memory found for ${label}.` };
        }
        return { success: true, content };
      }

      case 'list': {
        const topics = listTopics();
        return { success: true, topics, count: topics.length };
      }

      default:
        return { success: false, error: `Unknown action: ${String(action)}` };
    }
  },
});
