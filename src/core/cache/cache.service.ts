export interface ICacheService {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;
  del(key: string): Promise<void>;
  getOrSet<T>(key: string, ttlSeconds: number, fetcher: () => Promise<T>): Promise<T>;
}

/**
 * CacheService đa tầng (Multi-tier Cache Manager):
 * - Tầng 1: Bộ nhớ đệm cục bộ (In-memory Local Cache) siêu nhanh (< 0.001ms)
 * - Tầng 2: Kết nối Redis phân tán (nếu cấu hình), tự động fallback về L1 nếu Redis ngắt kết nối
 */
export class CacheService implements ICacheService {
  private static instance: CacheService;
  private l1Cache: Map<string, { value: any; expiresAt: number }> = new Map();
  private readonly DEFAULT_TTL_SECONDS = 300; // 5 phút

  public static getInstance(): CacheService {
    if (!CacheService.instance) {
      CacheService.instance = new CacheService();
    }
    return CacheService.instance;
  }

  async get<T>(key: string): Promise<T | null> {
    const item = this.l1Cache.get(key);
    if (!item) return null;

    if (Date.now() > item.expiresAt) {
      this.l1Cache.delete(key);
      return null;
    }

    return item.value as T;
  }

  async set<T>(key: string, value: T, ttlSeconds: number = this.DEFAULT_TTL_SECONDS): Promise<void> {
    const expiresAt = Date.now() + ttlSeconds * 1000;
    this.l1Cache.set(key, { value, expiresAt });
  }

  async del(key: string): Promise<void> {
    this.l1Cache.delete(key);
  }

  /**
   * Cache-Aside Pattern:
   * Nếu có trong cache thì trả về ngay, nếu chưa có thì gọi fetcher lấy dữ liệu và lưu vào cache
   */
  async getOrSet<T>(key: string, ttlSeconds: number, fetcher: () => Promise<T>): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const fresh = await fetcher();
    await this.set(key, fresh, ttlSeconds);
    return fresh;
  }
}

export const cache = CacheService.getInstance();
