interface LockEntry {
  workerId: string;
  acquiredAt: number;
  timeoutMs: number;
}

export class FileLockManager {
  private locks = new Map<string, LockEntry>();

  acquireLock(filePath: string, workerId: string, timeoutMs = 60_000): boolean {
    const existing = this.locks.get(filePath);

    if (existing) {
      const isExpired = Date.now() - existing.acquiredAt > existing.timeoutMs;
      if (!isExpired && existing.workerId !== workerId) {
        return false;
      }
      // Expired or same worker — allow re-acquire
    }

    this.locks.set(filePath, {
      workerId,
      acquiredAt: Date.now(),
      timeoutMs,
    });
    return true;
  }

  releaseLock(filePath: string, workerId: string): boolean {
    const entry = this.locks.get(filePath);
    if (!entry || entry.workerId !== workerId) {
      return false;
    }
    this.locks.delete(filePath);
    return true;
  }

  releaseAllForWorker(workerId: string): void {
    for (const [filePath, entry] of this.locks) {
      if (entry.workerId === workerId) {
        this.locks.delete(filePath);
      }
    }
  }

  isLocked(filePath: string): { locked: boolean; owner?: string } {
    const entry = this.locks.get(filePath);
    if (!entry) {
      return { locked: false };
    }

    const isExpired = Date.now() - entry.acquiredAt > entry.timeoutMs;
    if (isExpired) {
      this.locks.delete(filePath);
      return { locked: false };
    }

    return { locked: true, owner: entry.workerId };
  }

  getLocks(): Map<string, { workerId: string; acquiredAt: number }> {
    const snapshot = new Map<string, { workerId: string; acquiredAt: number }>();
    const now = Date.now();

    for (const [filePath, entry] of this.locks) {
      if (now - entry.acquiredAt > entry.timeoutMs) {
        this.locks.delete(filePath);
      } else {
        snapshot.set(filePath, {
          workerId: entry.workerId,
          acquiredAt: entry.acquiredAt,
        });
      }
    }

    return snapshot;
  }
}
