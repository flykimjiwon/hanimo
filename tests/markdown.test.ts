import { describe, it, expect } from 'vitest';
import { renderMarkdown } from '../src/core/markdown.js';

describe('renderMarkdown', () => {
  it('renders headers with ANSI formatting', () => {
    const result = renderMarkdown('# Hello\n## World\n### Sub');
    expect(result).toContain('Hello');
    expect(result).toContain('World');
    expect(result).toContain('Sub');
    // Should contain ANSI escape codes
    expect(result).toContain('\x1b[');
  });

  it('renders bold text', () => {
    const result = renderMarkdown('This is **bold** text');
    expect(result).toContain('\x1b[1m'); // BOLD
    expect(result).toContain('bold');
  });

  it('renders inline code', () => {
    const result = renderMarkdown('Use `npm install` here');
    expect(result).toContain('npm install');
    expect(result).toContain('\x1b[36m'); // CYAN
  });

  it('renders code blocks with fence', () => {
    const result = renderMarkdown('```typescript\nconst x = 1;\n```');
    expect(result).toContain('typescript');
    expect(result).toContain('const x = 1;');
    expect(result).toContain('┌'); // top border
    expect(result).toContain('└'); // bottom border
  });

  it('renders unordered lists', () => {
    const result = renderMarkdown('- Item one\n- Item two');
    expect(result).toContain('•');
    expect(result).toContain('Item one');
    expect(result).toContain('Item two');
  });

  it('renders ordered lists', () => {
    const result = renderMarkdown('1. First\n2. Second');
    expect(result).toContain('First');
    expect(result).toContain('Second');
  });

  it('renders horizontal rules', () => {
    const result = renderMarkdown('---');
    expect(result).toContain('─');
  });

  it('renders links', () => {
    const result = renderMarkdown('[Google](https://google.com)');
    expect(result).toContain('Google');
    expect(result).toContain('https://google.com');
  });

  it('passes through plain text', () => {
    const result = renderMarkdown('Just plain text here');
    expect(result).toBe('Just plain text here');
  });

  it('closes unclosed code blocks', () => {
    const result = renderMarkdown('```\nunclosed code');
    expect(result).toContain('└');
  });
});
