import { describe, it, expect } from 'vitest';
import { checkPathSandbox } from '../src/core/permission.js';

describe('checkPathSandbox', () => {
  const cwd = '/home/user/project';

  it('allows paths within cwd', () => {
    expect(checkPathSandbox('/home/user/project/src/index.ts', cwd)).toBeNull();
    expect(checkPathSandbox('/home/user/project/package.json', cwd)).toBeNull();
  });

  it('allows cwd itself', () => {
    expect(checkPathSandbox('/home/user/project', cwd)).toBeNull();
  });

  it('blocks paths outside cwd', () => {
    const result = checkPathSandbox('/etc/passwd', cwd);
    expect(result).toBeTruthy();
    expect(result).toContain('outside');
  });

  it('blocks sensitive directories', () => {
    // .ssh inside cwd should still be blocked
    expect(checkPathSandbox('/home/user/project/.ssh/id_rsa', cwd)).toBeTruthy();
    expect(checkPathSandbox('/home/user/project/.aws/credentials', cwd)).toBeTruthy();
    expect(checkPathSandbox('/home/user/project/.env', cwd)).toBeTruthy();
    expect(checkPathSandbox('/home/user/project/.env.local', cwd)).toBeTruthy();
  });

  it('allows dotfiles that are not sensitive', () => {
    expect(checkPathSandbox('/home/user/project/.gitignore', cwd)).toBeNull();
    expect(checkPathSandbox('/home/user/project/.eslintrc.json', cwd)).toBeNull();
  });

  it('blocks parent traversal attempts', () => {
    const result = checkPathSandbox('/home/user/other-project/secret.ts', cwd);
    expect(result).toBeTruthy();
  });
});
