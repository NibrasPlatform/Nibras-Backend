/**
 * Production-Grade Contest Sync Job
 * Features:
 * - Distributed locking (multi-instance safe)
 * - Concurrency limiting
 * - Queue-based processing
 * - Retry with exponential backoff
 * - Execution metrics
 */
const cron = require("node-cron");
const LockService = require("../core/services/lock.service");
const ConcurrencyLimiter = require("../core/utils/concurrencyLimiter");
const JobQueueService = require("../core/services/jobQueue.service");
const contestSyncService = require("../modules/contests/services/contestSync.service");
const logger = require("../core/utils/logger");

class ContestSyncJob {
  constructor() {
    this.task = null;
    this.schedule = process.env.CONTEST_SYNC_CRON || "0 */6 * * *";
    this.lockName = "contest-sync";
    this.lockTtl = 600;
    
    this.concurrency = parseInt(process.env.CONTEST_SYNC_CONCURRENCY || "5", 10);
    this.maxRetries = parseInt(process.env.CONTEST_SYNC_MAX_RETRIES || "3", 10);
    
    this.limiter = new ConcurrencyLimiter({ concurrency: this.concurrency, maxQueueSize: 100 });
    
    this.queue = new JobQueueService({
      name: "contest-sync",
      concurrency: this.concurrency,
      maxRetries: this.maxRetries,
      backoff: { type: "exponential", delay: 1000 },
    });

    this.metrics = {
      executions: 0,
      skipped: 0,
      failed: 0,
      totalDuration: 0,
    };

    this.setupQueueHandlers();
  }

  setupQueueHandlers() {
    this.queue.on("jobCompleted", ({ jobId, duration }) => {
      logger.debug(`Platform sync completed: ${jobId} in ${duration}ms`);
    });

    this.queue.on("jobFailed", ({ jobId, error, attempts }) => {
      logger.error(`Platform sync failed: ${jobId} after ${attempts} attempts - ${error}`);
    });

    this.queue.on("jobRetrying", ({ jobId, attempt, nextDelay }) => {
      logger.warn(`Retrying platform sync: ${jobId} (attempt ${attempt}, delay ${nextDelay}ms)`);
    });
  }

  start() {
    if (!cron.validate(this.schedule)) {
      logger.error(`Invalid cron schedule: ${this.schedule}`);
      return;
    }

    logger.info(`Starting contest sync job with schedule: ${this.schedule}`);
    logger.info(`Concurrency: ${this.concurrency}, Max retries: ${this.maxRetries}`);

    this.task = cron.schedule(this.schedule, async () => {
      const executionId = Date.now();
      const startTime = Date.now();

      logger.info(`[${executionId}] Contest sync triggered`);

      try {
        const lockAcquired = await LockService.acquire(
          this.lockName,
          this.lockTtl,
          { waitForLock: true, maxWaitMs: 30000 }
        );

        if (!lockAcquired) {
          logger.warn(`[${executionId}] Could not acquire lock, skipping execution`);
          this.metrics.skipped++;
          return;
        }

        const results = await this.executeSync(executionId);
        
        this.metrics.executions++;
        this.metrics.totalDuration += Date.now() - startTime;
        
        logger.info(
          `[${executionId}] Contest sync completed in ${Date.now() - startTime}ms: ` +
          `${results.new} new, ${results.updated} updated, ${results.failed.length} failed`
        );

      } catch (error) {
        this.metrics.failed++;
        logger.error(`[${executionId}] Contest sync failed: ${error.message}`);
      } finally {
        await LockService.release(this.lockName);
      }
    }, {
      scheduled: true,
      timezone: process.env.JOB_TIMEZONE || "Africa/Cairo",
    });

    this.queue.start(async (job) => {
      const adapter = job.data.adapter;
      logger.debug(`Processing platform: ${adapter.platformName}`);
      return await contestSyncService.syncPlatformContests(adapter);
    });

    logger.info("Contest sync job started successfully");
  }

  async executeSync(executionId) {
    const adapters = contestSyncService.adapters;
    
    const results = {
      success: [],
      failed: [],
      total: 0,
      new: 0,
      updated: 0,
    };

    const platformResults = await Promise.all(
      adapters.map(adapter => 
        this.limiter.execute(
          async () => {
            try {
              const result = await contestSyncService.syncPlatformContests(adapter);
              return { platform: adapter.platformName, ...result, failed: false };
            } catch (error) {
              return { platform: adapter.platformName, error: error.message, failed: true };
            }
          },
          { priority: 10, timeoutMs: 120000 }
        )
      )
    );

    for (const result of platformResults) {
      if (result.failed) {
        results.failed.push({ platform: result.platform, error: result.error });
      } else {
        results.success.push(result);
        results.total += result.total;
        results.new += result.new;
        results.updated += result.updated;
      }
    }

    return results;
  }

  stop() {
    if (this.task) {
      this.task.stop();
      logger.info("Contest sync job stopped");
    }
    this.queue.stop();
  }

  async runNow() {
    const executionId = Date.now();
    const startTime = Date.now();

    const lockAcquired = await LockService.acquire(
      `${this.lockName}-manual`,
      60,
      { waitForLock: true, maxWaitMs: 10000 }
    );

    if (!lockAcquired) {
      throw new Error("Manual sync already running");
    }

    try {
      logger.info("Running manual contest sync...");
      const results = await this.executeSync(executionId);
      logger.info(
        `Manual sync completed in ${Date.now() - startTime}ms: ` +
        `${results.new} new, ${results.updated} updated`
      );
      return results;
    } finally {
      await LockService.release(`${this.lockName}-manual`);
    }
  }

  getStats() {
    return {
      job: {
        executions: this.metrics.executions,
        skipped: this.metrics.skipped,
        failed: this.metrics.failed,
        avgDurationMs: this.metrics.executions > 0 
          ? Math.round(this.metrics.totalDuration / this.metrics.executions) 
          : 0,
      },
      limiter: this.limiter.getStats(),
      queue: this.queue.getStats(),
    };
  }
}

module.exports = new ContestSyncJob();