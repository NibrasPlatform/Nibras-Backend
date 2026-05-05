/**
 * Distributed Lock Service using Redis
 * Provides mutual exclusion across multiple instances
 */
const logger = require("../../core/utils/logger");

class LockService {
  constructor() {
    this.redisClient = null;
    this.defaultTtl = 300;
  }

  async getClient() {
    if (this.redisClient?.isOpen) {
      return this.redisClient;
    }

    const { createClient } = require("redis");
    const redisUrl = process.env.REDIS_URL || process.env.REDIS_HOST || "redis://localhost:6379";
    
    this.redisClient = createClient({ url: redisUrl });
    this.redisClient.on("error", (err) => logger.error("LockService Redis error:", err.message));
    
    await this.redisClient.connect();
    logger.info("LockService connected to Redis");
    return this.redisClient;
  }

  /**
   * Acquire a distributed lock
   * @param {string} key - Lock key
   * @param {number} ttlSeconds - Lock TTL in seconds
   * @param {object} options - Additional options
   * @returns {Promise<boolean>} - True if lock acquired
   */
  async acquire(key, ttlSeconds = this.defaultTtl, options = {}) {
    const { waitForLock = false, maxWaitMs = 5000, spinIntervalMs = 100 } = options;
    
    const client = await this.getClient();
    const lockKey = `lock:${key}`;
    
    const tryAcquire = async () => {
      const result = await client.set(lockKey, String(Date.now()), {
        NX: true,
        EX: ttlSeconds,
      });
      return result === "OK";
    };

    const acquired = await tryAcquire();
    
    if (acquired) {
      logger.debug(`Lock acquired: ${lockKey} for ${ttlSeconds}s`);
      return true;
    }

    if (!waitForLock) {
      logger.debug(`Lock not available: ${lockKey}`);
      return false;
    }

    const startTime = Date.now();
    while (Date.now() - startTime < maxWaitMs) {
      await new Promise(resolve => setTimeout(resolve, spinIntervalMs));
      if (await tryAcquire()) {
        logger.debug(`Lock acquired after waiting: ${lockKey}`);
        return true;
      }
    }

    logger.warn(`Lock wait timeout: ${lockKey}`);
    return false;
  }

  /**
   * Release a distributed lock
   * @param {string} key - Lock key
   */
  async release(key) {
    const client = await this.getClient();
    const lockKey = `lock:${key}`;
    await client.del(lockKey);
    logger.debug(`Lock released: ${lockKey}`);
  }

  /**
   * Execute function with lock protection
   * @param {string} key - Lock key
   * @param {Function} fn - Function to execute
   * @param {object} options - Lock options
   */
  async withLock(key, fn, options = {}) {
    const { ttl = this.defaultTtl, ...lockOptions } = options;
    
    const acquired = await this.acquire(key, ttl, lockOptions);
    
    if (!acquired) {
      throw new Error(`Failed to acquire lock: ${key}`);
    }

    try {
      return await fn();
    } finally {
      await this.release(key);
    }
  }

  /**
   * Check lock status (for debugging/monitoring)
   * @param {string} key - Lock key
   * @returns {Promise<object>} - Lock info
   */
  async getLockInfo(key) {
    const client = await this.getClient();
    const lockKey = `lock:${key}`;
    const value = await client.get(lockKey);
    
    if (!value) {
      return { locked: false };
    }

    return {
      locked: true,
      acquiredAt: new Date(parseInt(value)),
      ttl: await client.ttl(lockKey),
    };
  }
}

module.exports = new LockService();