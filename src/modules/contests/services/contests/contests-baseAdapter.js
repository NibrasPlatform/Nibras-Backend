const logger = require("../../../../core/utils/logger");

/**
 * Base adapter class for contest platform integrations
 * All platform adapters should extend this class
 */
class BaseContestAdapter {
  constructor(platformName) {
    this.platformName = platformName;
  }

  /**
   * Fetch contests from the platform
   * @returns {Promise<Array>} Array of normalized contest objects
   */
  async fetchContests() {
    throw new Error("fetchContests() must be implemented by subclass");
  }

  /**
   * Normalize contest data to match our schema
   * @param {Object} rawContest - Raw contest data from platform
   * @returns {Object} Normalized contest object
   */
  normalizeContest(rawContest) {
    throw new Error("normalizeContest() must be implemented by subclass");
  }

  /**
   * Determine contest status based on time
   * @param {Date} startTime - Contest start time
   * @param {Number} duration - Contest duration in seconds
   * @returns {String} "upcoming" | "running" | "finished"
   */
  getContestStatus(startTime, duration) {
    const now = new Date();
    const start = new Date(startTime);
    const end = new Date(start.getTime() + duration * 1000);

    if (now < start) {
      return "upcoming";
    } else if (now >= start && now < end) {
      return "running";
    } else {
      return "finished";
    }
  }

  /**
   * Log adapter activity
   * @param {String} message - Log message
   * @param {String} level - Log level (info, error, warn)
   */
  log(message, level = "info") {
    logger[level](`[${this.platformName}] ${message}`);
  }

  /**
   * Handle API errors gracefully
   * @param {Error} error - Error object
   * @param {String} context - Context of the error
   */
  handleError(error, context = "API call") {
    this.log(`Error during ${context}: ${error.message}`, "error");
    throw error;
  }
}

module.exports = BaseContestAdapter;
