/**
 * Production-Grade Competitive Profile Sync Job
 * Features:
 * - Distributed locking
 * - Batched processing
 * - Safe concurrency control
 * - Comprehensive error handling
 */
const cron = require("node-cron");
const LockService = require("../core/services/lock.service");
const ConcurrencyLimiter = require("../core/utils/concurrencyLimiter");
const competitiveProfileService = require("../modules/contests/services/competitiveProfile.service");
const logger = require("../core/utils/logger");

class CompetitiveProfileSyncJob {
  constructor() {
    this.task = null;
    this.schedule = process.env.PROFILE_SYNC_CRON || "0 */6 * * *";
    this.lockName = "profile-sync";
    this.lockTtl = 600;
    
    this.batchSize = parseInt(process.env.PROFILE_SYNC_BATCH_SIZE || "5", 10);
    this.concurrency = parseInt(process.env.PROFILE_SYNC_CONCURRENCY || "3", 10);
    
    this.limiter = new ConcurrencyLimiter({ 
      concurrency: this.concurrency, 
      maxQueueSize: 50 
    });

    this.metrics = {
      executions: 0,
      usersSynced: 0,
      usersFailed: 0,
      totalDuration: 0,
      skipped: 0,
    };
  }

  start() {
    if (!cron.validate(this.schedule)) {
      logger.error(`Invalid cron schedule: ${this.schedule}`);
      return;
    }

    logger.info(`Starting competitive profile sync job with schedule: ${this.schedule}`);
    logger.info(`Batch size: ${this.batchSize}, Concurrency: ${this.concurrency}`);

    this.task = cron.schedule(this.schedule, async () => {
      const startTime = Date.now();

      try {
        const lockAcquired = await LockService.acquire(
          this.lockName,
          this.lockTtl,
          { waitForLock: true, maxWaitMs: 30000 }
        );

        if (!lockAcquired) {
          logger.warn("Could not acquire lock for profile sync, skipping");
          this.metrics.skipped++;
          return;
        }

        const result = await this.syncDueProfiles();
        
        this.metrics.executions++;
        this.metrics.totalDuration += Date.now() - startTime;

        logger.info(
          `Profile sync completed in ${Date.now() - startTime}ms: ` +
          `${result.synced} synced, ${result.failed} failed`
        );

      } catch (error) {
        logger.error(`Profile sync failed: ${error.message}`);
      } finally {
        await LockService.release(this.lockName);
      }
    }, {
      scheduled: true,
      timezone: process.env.JOB_TIMEZONE || "Africa/Cairo",
    });

    logger.info("Competitive profile sync job started successfully");
  }

  async syncDueProfiles() {
    const result = { synced: 0, failed: 0 };
    
    const accounts = await competitiveProfileService.getDueAccounts(this.batchSize);
    
    if (accounts.length === 0) {
      logger.info("No profiles due for sync");
      return result;
    }

    logger.info(`Found ${accounts.length} profiles due for sync`);

    const syncPromises = accounts.map(account => 
      this.limiter.execute(
        async () => {
          try {
            await competitiveProfileService.refreshUserProfile(account.userId);
            return { success: true, userId: account.userId };
          } catch (error) {
            logger.warn(`Failed to sync profile for ${account.userId}: ${error.message}`);
            return { success: false, userId: account.userId, error: error.message };
          }
        },
        { priority: 5, timeoutMs: 180000 }
      )
    );

    const results = await Promise.allSettled(syncPromises);
    
    for (const r of results) {
      if (r.status === "fulfilled" && r.value?.success) {
        result.synced++;
      } else {
        result.failed++;
      }
    }

    return result;
  }

  stop() {
    if (this.task) {
      this.task.stop();
      logger.info("Competitive profile sync job stopped");
    }
  }

  async runNow() {
    const lockAcquired = await LockService.acquire(
      `${this.lockName}-manual`,
      60,
      { waitForLock: true, maxWaitMs: 10000 }
    );

    if (!lockAcquired) {
      throw new Error("Manual profile sync already running");
    }

    try {
      logger.info("Running manual profile sync...");
      const result = await this.syncDueProfiles();
      logger.info(`Manual profile sync completed: ${result.synced} synced, ${result.failed} failed`);
      return result;
    } finally {
      await LockService.release(`${this.lockName}-manual`);
    }
  }

  getStats() {
    return {
      metrics: this.metrics,
      limiter: this.limiter.getStats(),
    };
  }
}

module.exports = new CompetitiveProfileSyncJob();