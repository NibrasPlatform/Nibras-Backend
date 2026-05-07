const { createClient } = require("redis");
const logger = require("../../../core/utils/logger");

class CacheService {
  constructor() {
    this.client = null;
    this.disabled = !process.env.REDIS_URL;
    this.connectingPromise = null;
  }

  isEnabled() {
    return !this.disabled;
  }

  async getClient() {
    if (this.disabled) {
      return null;
    }

    if (this.client && this.client.isOpen) {
      return this.client;
    }

    if (this.connectingPromise) {
      await this.connectingPromise;
      return this.client;
    }

    this.client = createClient({
      url: process.env.REDIS_URL,
    });
    this.client.on("error", (error) => {
      logger.error("Redis client error", error.message);
    });

    this.connectingPromise = this.client.connect().finally(() => {
      this.connectingPromise = null;
    });
    await this.connectingPromise;
    return this.client;
  }

  async get(key) {
    const client = await this.getClient();
    if (!client) return null;

    const value = await client.get(key);
    return value ? JSON.parse(value) : null;
  }

  async set(key, value, ttlSeconds) {
    const client = await this.getClient();
    if (!client) return;

    if (ttlSeconds) {
      await client.set(key, JSON.stringify(value), { EX: ttlSeconds });
      return;
    }
    await client.set(key, JSON.stringify(value));
  }

  async del(key) {
    const client = await this.getClient();
    if (!client) return;
    await client.del(key);
  }

  async setIfNotExists(key, value, ttlSeconds) {
    const client = await this.getClient();
    if (!client) return false;

    const options = { NX: true };
    if (ttlSeconds) {
      options.EX = ttlSeconds;
    }
    const result = await client.set(key, String(value), options);
    return result === "OK";
  }

  async ttl(key) {
    const client = await this.getClient();
    if (!client) return -1;
    return client.ttl(key);
  }

  async incrementWithWindow(key, windowSeconds) {
    const client = await this.getClient();
    if (!client) {
      return {
        count: 0,
        ttlSeconds: 0,
      };
    }

    const count = await client.incr(key);
    if (count === 1) {
      await client.expire(key, windowSeconds);
    }

    const ttlSeconds = await client.ttl(key);
    return { count, ttlSeconds: Math.max(ttlSeconds, 0) };
  }
}

module.exports = new CacheService();
