/**
 * Concurrency Limiter - Controls parallel execution
 * Prevents system overload from Promise.all saturation
 */
const EventEmitter = require("events");

class ConcurrencyLimiter extends EventEmitter {
  constructor(options = {}) {
    super();
    this.concurrency = options.concurrency || 5;
    this.maxQueueSize = options.maxQueueSize || 1000;
    this.queue = [];
    this.running = 0;
    this.completed = 0;
    this.failed = 0;
    this.totalDuration = 0;
  }

  /**
   * Execute a task with concurrency control
   * @param {Function} task - Async function to execute
   * @param {object} options - Task options
   * @returns {Promise<any>} - Task result
   */
  async execute(task, options = {}) {
    const { priority = 0, timeoutMs = 60000 } = options;
    
    return new Promise((resolve, reject) => {
      const taskItem = {
        task,
        resolve,
        reject,
        priority,
        timeoutMs,
        startTime: Date.now(),
      };

      if (this.running >= this.concurrency) {
        if (this.queue.length >= this.maxQueueSize) {
          return reject(new Error(`Queue full: ${this.queue.length} tasks waiting`));
        }
        this.queue.push(taskItem);
        this.emit("queued", { queueSize: this.queue.length });
        return;
      }

      this._runTask(taskItem);
    });
  }

  _runTask(taskItem) {
    this.running++;
    const taskStartTime = Date.now();

    Promise.race([
      taskItem.task(),
      this._createTimeout(taskItem.timeoutMs),
    ])
      .then((result) => {
        this.completed++;
        this.totalDuration += Date.now() - taskStartTime;
        taskItem.resolve(result);
      })
      .catch((error) => {
        this.failed++;
        taskItem.reject(error);
      })
      .finally(() => {
        this.running--;
        this._processQueue();
      });
  }

  _createTimeout(timeoutMs) {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Task timeout after ${timeoutMs}ms`));
      }, timeoutMs);
    });
  }

  _processQueue() {
    if (this.queue.length === 0 || this.running >= this.concurrency) {
      return;
    }

    this.queue.sort((a, b) => b.priority - a.priority);
    const nextTask = this.queue.shift();
    this._runTask(nextTask);
  }

  /**
   * Get current stats
   */
  getStats() {
    const avgDuration = this.completed > 0 ? this.totalDuration / this.completed : 0;
    return {
      running: this.running,
      queued: this.queue.length,
      completed: this.completed,
      failed: this.failed,
      concurrency: this.concurrency,
      avgDurationMs: Math.round(avgDuration),
    };
  }

  /**
   * Update concurrency dynamically
   */
  setConcurrency(value) {
    this.concurrency = Math.max(1, Math.min(value, 100));
    this._processQueue();
  }

  /**
   * Drain all pending tasks
   */
  async drain() {
    const pending = [...this.queue];
    this.queue = [];
    return pending.map((task) => task.task());
  }
}

module.exports = ConcurrencyLimiter;