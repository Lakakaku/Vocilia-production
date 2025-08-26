import Redis from 'ioredis';
import { logger } from '../utils/logger';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

export const redis = new Redis(redisUrl, {
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  lazyConnect: false
});

redis.on('connect', () => {
  logger.info('Connected to Redis');
});

redis.on('error', (error) => {
  logger.error('Redis connection error:', error);
});

redis.on('close', () => {
  logger.warn('Redis connection closed');
});

// Helper functions for common operations
export const setWithExpiry = async (key: string, value: any, ttl: number): Promise<void> => {
  await redis.setex(key, ttl, JSON.stringify(value));
};

export const getJSON = async <T>(key: string): Promise<T | null> => {
  const value = await redis.get(key);
  return value ? JSON.parse(value) : null;
};

export const incrementCounter = async (key: string, ttl?: number): Promise<number> => {
  const count = await redis.incr(key);
  if (ttl && count === 1) {
    await redis.expire(key, ttl);
  }
  return count;
};

export const addToSet = async (key: string, ...members: string[]): Promise<number> => {
  return await redis.sadd(key, ...members);
};

export const getSetMembers = async (key: string): Promise<string[]> => {
  return await redis.smembers(key);
};

export const pushToList = async (key: string, ...values: string[]): Promise<number> => {
  return await redis.rpush(key, ...values);
};

export const popFromList = async (key: string): Promise<string | null> => {
  return await redis.lpop(key);
};

export const publishMessage = async (channel: string, message: any): Promise<number> => {
  return await redis.publish(channel, JSON.stringify(message));
};

// Time series data helpers
export const recordMetric = async (
  businessId: string,
  metricType: string,
  value: number,
  ttl: number = 86400 // 24 hours default
): Promise<void> => {
  const hour = new Date().getHours();
  const key = `perf:${businessId}:${hour}`;
  const globalKey = `perf:global:${hour}`;
  
  await redis.hincrbyfloat(key, metricType, value);
  await redis.hincrbyfloat(globalKey, metricType, value);
  
  await redis.expire(key, ttl);
  await redis.expire(globalKey, ttl);
};

// Alert management
export const createAlert = async (
  businessId: string,
  severity: 'error' | 'warning' | 'info',
  title: string,
  description: string
): Promise<void> => {
  const alertKey = `alert:${businessId}:${Date.now()}`;
  await redis.hmset(alertKey, {
    severity,
    title,
    description,
    timestamp: new Date().toISOString(),
    businessId
  });
  await redis.expire(alertKey, 3600); // Expire after 1 hour
};

// Cache management
export class CacheManager {
  private defaultTTL: number;

  constructor(defaultTTL: number = 300) {
    this.defaultTTL = defaultTTL;
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const cached = await redis.get(key);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      logger.error(`Cache get error for key ${key}:`, error);
      return null;
    }
  }

  async set(key: string, value: any, ttl?: number): Promise<void> {
    try {
      await redis.setex(key, ttl || this.defaultTTL, JSON.stringify(value));
    } catch (error) {
      logger.error(`Cache set error for key ${key}:`, error);
    }
  }

  async invalidate(pattern: string): Promise<void> {
    try {
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } catch (error) {
      logger.error(`Cache invalidation error for pattern ${pattern}:`, error);
    }
  }
}

export const cache = new CacheManager();