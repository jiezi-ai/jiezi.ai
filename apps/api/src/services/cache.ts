export class CacheService {
  constructor(private kv: KVNamespace) {}

  async get<T>(key: string): Promise<T | null> {
    const val = await this.kv.get(key, "text");
    if (!val) return null;
    return JSON.parse(val) as T;
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    const opts: KVNamespacePutOptions = {};
    if (ttlSeconds) opts.expirationTtl = ttlSeconds;
    await this.kv.put(key, JSON.stringify(value), opts);
  }

  async invalidate(key: string): Promise<void> {
    await this.kv.delete(key);
  }

  async invalidatePrefix(prefix: string): Promise<void> {
    const list = await this.kv.list({ prefix });
    await Promise.all(list.keys.map((k) => this.kv.delete(k.name)));
  }
}
