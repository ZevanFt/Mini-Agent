import fs from 'fs';
import path from 'path';

export interface VersionInfo {
  current: string;
  latest: string;
  updateAvailable: boolean;
  releaseNotes?: string;
}

interface CacheEntry {
  latest: string;
  releaseNotes?: string;
  checkedAt: string;
}

const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;

export class AutoUpdateChecker {
  private currentVersion: string;
  private lastCheck?: Date;
  private cacheFile: string;

  constructor(currentVersion: string, cacheFile?: string) {
    this.currentVersion = currentVersion;
    this.cacheFile = cacheFile || path.join(process.env.HOME || '', '.miniagent', 'update-cache.json');
    this.loadLastCheck();
  }

  async check(): Promise<VersionInfo> {
    const cached = this.getCache();
    if (cached && !this.shouldCheck()) {
      return cached;
    }

    let latest = this.currentVersion;
    let releaseNotes: string | undefined;

    try {
      const response = await fetch('https://registry.npmjs.org/miniagent/latest');
      if (response.ok) {
        const data = (await response.json()) as { version?: string; description?: string };
        latest = data.version || this.currentVersion;
        releaseNotes = data.description;
      }
    } catch {
      if (cached) {
        return cached;
      }
    }

    const updateAvailable = this.isNewer(latest, this.currentVersion);
    const result: VersionInfo = {
      current: this.currentVersion,
      latest,
      updateAvailable,
      releaseNotes: updateAvailable ? releaseNotes : undefined,
    };

    this.saveCache(result);
    this.lastCheck = new Date();
    return result;
  }

  getCache(): VersionInfo | null {
    try {
      if (!fs.existsSync(this.cacheFile)) {
        return null;
      }
      const raw = fs.readFileSync(this.cacheFile, 'utf-8');
      const entry = JSON.parse(raw) as CacheEntry;
      const age = Date.now() - new Date(entry.checkedAt).getTime();
      if (age > CHECK_INTERVAL_MS * 2) {
        return null;
      }
      return {
        current: this.currentVersion,
        latest: entry.latest,
        updateAvailable: this.isNewer(entry.latest, this.currentVersion),
        releaseNotes: entry.releaseNotes,
      };
    } catch {
      return null;
    }
  }

  shouldCheck(): boolean {
    if (!this.lastCheck) {
      return true;
    }
    return Date.now() - this.lastCheck.getTime() >= CHECK_INTERVAL_MS;
  }

  private isNewer(latest: string, current: string): boolean {
    if (latest === current) {
      return false;
    }
    const parse = (v: string) => v.split('.').map(n => parseInt(n, 10) || 0);
    const a = parse(latest);
    const b = parse(current);
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      const x = a[i] || 0;
      const y = b[i] || 0;
      if (x > y) return true;
      if (x < y) return false;
    }
    return false;
  }

  private saveCache(info: VersionInfo): void {
    try {
      const dir = path.dirname(this.cacheFile);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const entry: CacheEntry = {
        latest: info.latest,
        releaseNotes: info.releaseNotes,
        checkedAt: new Date().toISOString(),
      };
      fs.writeFileSync(this.cacheFile, JSON.stringify(entry));
    } catch {
    }
  }

  private loadLastCheck(): void {
    const cached = this.getCache();
    if (cached) {
      this.lastCheck = new Date();
    }
  }
}
