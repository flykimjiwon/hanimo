import { createOpenAI } from '@ai-sdk/openai';
import { streamText } from 'ai';

const provider = createOpenAI({
  apiKey: 'not-needed',
  baseURL: 'http://localhost:11434/v1',
  compatibility: 'compatible',
});

const model = provider('gemma3:1b');

// Test A: with system prompt (like agent-loop does)
console.log('=== Test A: streamText + system prompt ===');
try {
  const result = streamText({
    model,
    system: 'You are a helpful assistant.',
    messages: [{ role: 'user', content: '반가워' }],
  });
  let text = '';
  for await (const chunk of result.textStream) {
    process.stdout.write(chunk);
    text += chunk;
  }
  console.log('\n[Length:', text.length, ']');
} catch (e) {
  console.error('Error:', e);
}

// Test B: with system + maxSteps
console.log('\n=== Test B: streamText + system + maxSteps=1 ===');
try {
  const result = streamText({
    model,
    system: 'You are a helpful assistant.',
    messages: [{ role: 'user', content: '하이' }],
    maxSteps: 1,
  });
  let text = '';
  for await (const chunk of result.textStream) {
    process.stdout.write(chunk);
    text += chunk;
  }
  console.log('\n[Length:', text.length, ']');
} catch (e) {
  console.error('Error:', e);
}

// Test C: with long system prompt (like actual system prompt)
console.log('\n=== Test C: streamText + full system prompt ===');
try {
  const longSystem = `You are dev-anywhere, a terminal-based AI coding assistant.

## Capabilities
- Read, write, and edit files in the project directory
- Search files with glob patterns and grep content search
- Run shell commands and view output

## Guidelines
- Be concise. Avoid unnecessary explanation.
- Use the simplest approach that solves the problem.

## Environment
- Working directory: /Users/kimjiwon/Desktop/kimjiwon
- Platform: darwin`;

  const result = streamText({
    model,
    system: longSystem,
    messages: [{ role: 'user', content: '안녕' }],
    maxSteps: 1,
  });
  let text = '';
  for await (const chunk of result.textStream) {
    process.stdout.write(chunk);
    text += chunk;
  }
  console.log('\n[Length:', text.length, ']');
} catch (e) {
  console.error('Error:', e);
}
