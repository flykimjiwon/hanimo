import { describe, it, expect, vi } from 'vitest';
import { bell } from '../src/tools/notify.js';

describe('notify', () => {
  it('bell() should write BEL character to stdout', () => {
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    bell();
    expect(writeSpy).toHaveBeenCalledWith('\x07');
    writeSpy.mockRestore();
  });
});
