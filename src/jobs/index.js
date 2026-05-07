const logger = require("../core/utils/logger");
const contestSyncJob = require("./contestSync.job");
const contestStatusUpdateJob = require("./contestStatusUpdate.job");
const reminderNotificationJob = require("./reminderNotification.job");
const competitiveProfileSyncJob = require("./competitiveProfileSync.job");
const verificationRevalidationJob = require("./verificationRevalidation.job");
const maintenanceJob = require("./maintenance.job");

const jobs = [
  contestSyncJob,
  contestStatusUpdateJob,
  reminderNotificationJob,
  competitiveProfileSyncJob,
  verificationRevalidationJob,
  maintenanceJob,
];

let jobsStarted = false;

const startAllJobs = () => {
  if (jobsStarted) {
    logger.warn("Jobs already started, skipping...");
    return;
  }

  const enabled = process.env.ENABLE_JOBS !== "false";
  if (!enabled) {
    logger.info("Background jobs are disabled via ENABLE_JOBS=false");
    return;
  }

  jobs.forEach((job) => {
    try {
      job.start();
    } catch (error) {
      logger.error(`Failed to start job ${job.constructor.name}:`, error.message);
    }
  });

  jobsStarted = true;
  logger.info(`Jobs bootstrap initialized (${jobs.length} jobs started)`);
};

const stopAllJobs = () => {
  jobs.forEach((job) => {
    try {
      job.stop();
    } catch (error) {
      logger.error(`Failed to stop job ${job.constructor.name}:`, error.message);
    }
  });
  jobsStarted = false;
  logger.info("Jobs shutdown completed");
};

const getJobsStats = () => {
  return jobs.map((job) => ({
    name: job.constructor?.name || "Unknown",
    stats: typeof job.getStats === "function" ? job.getStats() : null,
  }));
};

const runJobNow = async (jobName) => {
  const job = jobs.find(j => j.constructor?.name === jobName);
  if (!job || typeof job.runNow !== "function") {
    throw new Error(`Job ${jobName} not found or not manually executable`);
  }
  return await job.runNow();
};

module.exports = {
  startAllJobs,
  stopAllJobs,
  getJobsStats,
  runJobNow,
};
