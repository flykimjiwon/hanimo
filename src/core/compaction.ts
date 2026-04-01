import { generateText } from 'ai';
import type { LanguageModelV1 } from 'ai';
import type { Message } from './types.js';
import { isEnabled } from './feature-flags.js';

const MAX_CONTEXT_MESSAGES = 40;

const COMPACTION_PROMPT = `You are a conversation compactor. Summarize the conversation so far into a concise context summary that preserves:
1. What the user asked for (original task/goal)
2. What has been done so far (files modified, commands run, key decisions)
3. Current state (what's working, what's not, what remains)
4. Important code snippets or paths mentioned

Be concise but preserve all actionable information. Output only the summary, no preamble.`;

/**
 * Stage 1 (Snip): Replace old tool results with short placeholders.
 * Only targets tool-result content in messages older than keepRecent.
 */
function snipOldToolResults(messages: Message[], keepRecent: number): Message[] {
  if (messages.length <= keepRecent) return messages;

  const cutoff = messages.length - keepRecent;
  return messages.map((msg, idx) => {
    if (idx >= cutoff) return msg; // Keep recent messages intact

    // Check for tool result content (array form from AI SDK)
    if (Array.isArray(msg.content)) {
      const newContent = (msg.content as unknown as Array<Record<string, unknown>>).map(part => {
        if (part['type'] === 'tool-result' && typeof part['result'] === 'string') {
          const result = part['result'] as string;
          if (result.length > 2000) {
            const lineCount = result.split('\n').length;
            return { ...part, result: `[snipped: ${lineCount} lines]` };
          }
        }
        return part;
      });
      return { ...msg, content: newContent } as unknown as Message;
    }

    // String content with tool results embedded
    if (typeof msg.content === 'string' && msg.content.length > 2000 && msg.role === 'tool') {
      const lineCount = (msg.content as string).split('\n').length;
      return { ...msg, content: `[snipped: ${lineCount} lines]` } as unknown as Message;
    }

    return msg;
  });
}

/**
 * Stage 2 (Micro): Truncate middle of very long individual messages.
 * Keeps first half + last half, inserts truncation marker.
 */
function microCompact(messages: Message[]): Message[] {
  const THRESHOLD = 3000;

  return messages.map(msg => {
    if (typeof msg.content !== 'string') return msg;
    if (msg.content.length <= THRESHOLD) return msg;

    const halfLen = Math.floor(THRESHOLD / 2);
    const head = msg.content.slice(0, halfLen);
    const tail = msg.content.slice(-halfLen);
    const removed = msg.content.length - THRESHOLD;

    return {
      ...msg,
      content: `${head}\n[...truncated ${removed} chars...]\n${tail}`,
    } as unknown as Message;
  });
}

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

  let processed = [...messages];

  // Stage 1 + 2: Lightweight pre-processing (if multi-stage enabled)
  if (isEnabled('MULTI_STAGE_COMPACTION')) {
    processed = snipOldToolResults(processed, keepRecent);
    processed = microCompact(processed);

    // If lightweight stages reduced enough, skip LLM summarization
    const totalLength = processed.reduce((sum, m) => {
      const len = typeof m.content === 'string' ? m.content.length : JSON.stringify(m.content).length;
      return sum + len;
    }, 0);

    // If under 50K chars after snip+micro, the lightweight compaction is enough
    if (totalLength < 50000 && processed.length <= MAX_CONTEXT_MESSAGES) {
      return processed;
    }
  }

  // Stage 3 (Auto): LLM summarization
  const toSummarize = processed.slice(0, processed.length - keepRecent);
  const recentMessages = processed.slice(processed.length - keepRecent);

  const conversationText = toSummarize
    .map((m) => {
      const role = m.role === 'user' ? 'User' : m.role === 'assistant' ? 'Assistant' : 'System';
      const content = typeof m.content === 'string'
        ? m.content
        : JSON.stringify(m.content);
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
    // Stage 4 (Truncation): Simple fallback
    const head = processed.slice(0, 2);
    const tail = processed.slice(-(keepRecent));
    return [
      ...head,
      { role: 'system' as const, content: '[Earlier messages truncated to fit context window]' },
      ...tail,
    ];
  }
}
