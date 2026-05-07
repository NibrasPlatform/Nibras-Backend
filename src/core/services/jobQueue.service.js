/**
 * Job Queue Service - Queue-based processing with BullMQ-compatible API
 * This provides the foundation - can be swapped to actual BullMQ later
 */
const EventEmitter = require("events");
const LockService = require("../services/lock.service");
const logger = require("../../core/utils/logger");

const JOB_STATES = {
  WAITING: "waiting",
  ACTIVE: "active",
  COMPLETED: "completed",
  FAILED: "failed",
  DELAYED: "delayed",
};

class JobQueueService extends EventEmitter {
  constructor(options = {}) {
    super();
    this.name = options.name || "default";
    this.concurrency = options.concurrency || 5;
    this.lockTtl = options.lockTtl || 300;
    this.maxRetries = options.maxRetries || 3;
    this.backoff = options.backoff || { type: "exponential", delay: 1000 };
    
    this.running = new Map();
    this.jobs = new Map();
    this.metrics = {
      completed: 0,
      failed: 0,
      active: 0,
      totalDuration: 0,
    };
    
    this.processing = false;
    this.processInterval = null;
  }

  /**
   * Add a job to the queue
   * @param {string} jobId - Unique job ID
   * @param {any} data - Job data
   * @param {object} options - Job options
   */
  async add(jobId, data, options = {}) {
    const job = {
      id: jobId,
      data,
      options: {
        priority: options.priority || 0,
        delay: options.delay || 0,
        attempts: options.attempts || this.maxRetries,
        timeout: options.timeout || 60000,
        ...options,
      },
      state: options.delay > 0 ? JOB_STATES.DELAYED : JOB_STATES.WAITING,
      attempts: 0,
      createdAt: Date.now(),
      scheduledAt: options.delay ? Date.now() + options.delay : null,
      failedReason: null,
    };

    this.jobs.set(jobId, job);
    this.emit("jobAdded", { jobId, state: job.state });
    
    logger.debug(`Job added to queue ${this.name}: ${jobId}`);
    return job;
  }

  /**
   * Process jobs from the queue
   * @param {Function} processor - Job processor function
   */
  start(processor) {
    if (this.processing) return;
    
    this.processor = processor;
    this.processing = true;
    
    this.processInterval = setInterval(() => this._processLoop(), 1000);
    logger.info(`Job queue ${this.name} started`);
  }

  stop() {
    this.processing = false;
    if (this.processInterval) {
      clearInterval(this.processInterval);
    }
    logger.info(`Job queue ${this.name} stopped`);
  }

  async _processLoop() {
    if (this.running.size >= this.concurrency) return;

    const now = Date.now();
    const candidates = Array.from(this.jobs.values())
      .filter(job => 
        job.state === JOB_STATES.WAITING && 
        (!job.scheduledAt || job.scheduledAt <= now)
      )
      .sort((a, b) => b.options.priority - a.options.priority);

    for (const job of candidates) {
      if (this.running.size >= this.concurrency) break;
      
      await this._processJob(job);
    }
  }

  async _processJob(job) {
    const lockKey = `job:${this.name}:${job.id}`;
    
    try {
      const lockAcquired = await LockService.acquire(lockKey, 60, { 
        waitForLock: false 
      });
      
      if (!lockAcquired) {
        logger.debug(`Job ${job.id} is being processed by another worker`);
        return;
      }

      job.state = JOB_STATES.ACTIVE;
      job.startedAt = Date.now();
      this.running.set(job.id, job);
      this.metrics.active = this.running.size;
      this.emit("jobStarted", { jobId: job.id });

      const startTime = Date.now();
      
      try {
        const result = await Promise.race([
          this.processor(job),
          this._createTimeout(job.options.timeout),
        ]);

        this.metrics.completed++;
        this.metrics.totalDuration += Date.now() - startTime;
        
        job.state = JOB_STATES.COMPLETED;
        job.result = result;
        job.completedAt = Date.now();
        
        this.running.delete(job.id);
        await LockService.release(lockKey);
        
        this.emit("jobCompleted", { jobId: job.id, duration: Date.now() - startTime });
        logger.debug(`Job ${job.id} completed in ${Date.now() - startTime}ms`);
        
      } catch (error) {
        await this._handleJobFailure(job, error, lockKey);
      }

    } catch (error) {
      logger.error(`Error processing job ${job.id}:`, error.message);
    }
  }

  async _handleJobFailure(job, error, lockKey) {
    job.attempts++;
    job.failedReason = error.message;
    
    if (job.attempts >= job.options.attempts) {
      this.metrics.failed++;
      job.state = JOB_STATES.FAILED;
      this.running.delete(job.id);
      await LockService.release(lockKey);
      
      this.emit("jobFailed", { jobId: job.id, error: error.message, attempts: job.attempts });
      logger.error(`Job ${job.id} failed permanently after ${job.attempts} attempts: ${error.message}`);
    } else {
      const delay = this._calculateBackoff(job.attempts);
      job.state = JOB_STATES.DELAYED;
      job.scheduledAt = Date.now() + delay;
      this.running.delete(job.id);
      await LockService.release(lockKey);
      
      this.emit("jobRetrying", { jobId: job.id, attempt: job.attempts, nextDelay: delay });
      logger.warn(`Job ${job.id} failed, retry ${job.attempts}/${job.options.attempts} in ${delay}ms`);
    }
  }

  _calculateBackoff(attempt) {
    if (this.backoff.type === "exponential") {
      return Math.min(this.backoff.delay * Math.pow(2, attempt - 1), 300000);
    }
    return this.backoff.delay;
  }

  _createTimeout(timeoutMs) {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`Job timeout after ${timeoutMs}ms`)), timeoutMs);
    });
  }

  /**
   * Get queue statistics
   */
  getStats() {
    const states = {};
    for (const job of this.jobs.values()) {
      states[job.state] = (states[job.state] || 0) + 1;
    }

    return {
      name: this.name,
      totalJobs: this.jobs.size,
      states,
      running: this.running.size,
      metrics: this.metrics,
    };
  }

  /**
   * Clean up old completed/failed jobs
   */
  cleanOldJobs(maxAgeMs = 86400000) {
    const cutoff = Date.now() - maxAgeMs;
    let cleaned = 0;
    
    for (const [id, job] of this.jobs.entries()) {
      if ((job.state === JOB_STATES.COMPLETED || job.state === JOB_STATES.FAILED) &&
          job.completedAt && job.completedAt < cutoff) {
        this.jobs.delete(id);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      logger.info(`Cleaned ${cleaned} old jobs from queue ${this.name}`);
    }
    
    return cleaned;
  }
}

module.exports = JobQueueService;