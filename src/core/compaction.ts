import { generateText } from 'ai';
import type { LanguageModelV1 } from 'ai';
import type { Message } from './types.js';

const COMPACTION_PROMPT = `You are a conversation compactor. Summarize the conversation so far into a concise context summary that preserves:
1. What the user asked for (original task/goal)
2. What has been done so far (files modified, commands run, key decisions)
3. Current state (what's working, what's not, what remains)
4. Important code snippets or paths mentioned

Be concise but preserve all actionable information. Output only the summary, no preamble.`;

/**
 * Smart context compaction: instead of just truncating messages,
 * use the LLM to summarize the conversation history.
 * Returns a compacted message array with a summary system message.
 */
export async function compactMessages(
  model: LanguageModelV1,
  messages: Message[],
  keepRecent: number = 6,
): Promise<Message[]> {
  if (messages.length <= keepRecent + 2) return messages;

  // Split: messages to summarize vs recent to keep
  const toSummarize = messages.slice(0, messages.length - keepRecent);
  const recentMessages = messages.slice(messages.length - keepRecent);

  // Build conversation text for summarization
  const conversationText = toSummarize
    .map((m) => {
      const role = m.role === 'user' ? 'User' : m.role === 'assistant' ? 'Assistant' : 'System';
      const content = typeof m.content === 'string'
        ? m.content
        : JSON.stringify(m.content);
      // Truncate very long messages in the summary input
      const truncated = content.length > 2000
        ? content.slice(0, 2000) + '...(truncated)'
        : content;
      return `[${role}]: ${truncated}`;
    })
    .join('\n\n');

  try {
    const result = await generateText({
      model,
      system: COMPACTION_PROMPT,
      prompt: conversationText,
      maxTokens: 1500,
    });

    const summary: Message = {
      role: 'system',
      content: `[Conversation Summary]\n${result.text}\n\n[End of summary — recent messages follow]`,
    };

    return [summary, ...recentMessages];
  } catch {
    // Fallback to simple truncation if summarization fails
    const head = messages.slice(0, 2);
    const tail = messages.slice(-(keepRecent));
    return [
      ...head,
      { role: 'system' as const, content: '[Earlier messages truncated to fit context window]' },
      ...tail,
    ];
  }
}
