const Contest = require("../models/contest.model");
const CodeforcesAdapter = require("./contests/contests-codeforcesAdapter");
const HackerRankAdapter = require("./contests/contests-hackerrankAdapter");
const LeetCodeAdapter = require("./contests/contests-leetcodeAdapter");
const logger = require("../../../core/utils/logger");

/**
 * Service to sync contests from all platforms
 */
class ContestSyncService {
  constructor() {
    this.adapters = [
      new CodeforcesAdapter(),
      new HackerRankAdapter(),
      new LeetCodeAdapter(),
    ];
  }

  /**
   * Sync contests from all platforms
   * @returns {Promise<Object>} Sync results
   */
  async syncAllContests() {
    logger.info("Starting contest sync from all platforms...");
    const results = {
      success: [],
      failed: [],
      total: 0,
      new: 0,
      updated: 0,
    };

    for (const adapter of this.adapters) {
      try {
        const platformResults = await this.syncPlatformContests(adapter);
        results.success.push({
          platform: adapter.platformName,
          ...platformResults,
        });
        results.total += platformResults.total;
        results.new += platformResults.new;
        results.updated += platformResults.updated;
      } catch (error) {
        logger.error(
          `Failed to sync ${adapter.platformName} contests: ${error.message}`
        );
        results.failed.push({
          platform: adapter.platformName,
          error: error.message,
        });
      }
    }

    logger.info(
      `Contest sync completed: ${results.new} new, ${results.updated} updated, ${results.failed.length} failed`
    );
    return results;
  }

  /**
   * Sync contests from a specific platform
   * @param {BaseContestAdapter} adapter - Platform adapter
   * @returns {Promise<Object>} Platform sync results
   */
  async syncPlatformContests(adapter, status) {
    try {
      const contests = await adapter.fetchContests(status);
      console.log("contests", contests);
      const results = {
        total: contests.length,
        new: 0,
        updated: 0,
        skipped: 0,
      };

      for (const contestData of contests) {
        try {
          await this.saveContest(contestData, results);
        } catch (error) {
          logger.error(
            `Error saving contest ${contestData.title}: ${error.message}`
          );
          results.skipped++;
        }
      }

      return results;
    } catch (error) {
      logger.error(
        `Error syncing ${adapter.platformName} contests: ${error.message}`
      );
      throw error;
    }
  }

  /**
   * Save or update a single contest
   * @param {Object} contestData - Normalized contest data
   * @param {Object} results - Results object to update
   */
  async saveContest(contestData, results) {
    const existingContest = await Contest.findOne({
      platform: contestData.platform,
      contestIdOnPlatform: contestData.contestIdOnPlatform,
    });

    if (existingContest) {
      // Update existing contest
      const updated = await Contest.findByIdAndUpdate(
        existingContest._id,
        {
          ...contestData,
          lastSyncedAt: new Date(),
        },
        { returnDocument: "after" }
      );
      
      if (updated) {
        results.updated++;
        logger.info(
          `Updated contest: ${contestData.title} (${contestData.platform})`
        );
      }
    } else {
      // Create new contest
      const newContest = await Contest.create(contestData);
      if (newContest) {
        results.new++;
        logger.info(
          `Created new contest: ${contestData.title} (${contestData.platform})`
        );
      }
    }
  }

  /**
   * Sync contests from a specific platform only
   * @param {String} platformName - Platform name (codeforces, hackerrank, leetcode)
   * @returns {Promise<Object>} Sync results
   */
  async syncPlatform(platformName, status) {
    const adapter = this.adapters.find(
      (a) => a.platformName.toLowerCase() === platformName.toLowerCase()
    );

    if (!adapter) {
      throw new Error(`Unknown platform: ${platformName}`);
    }

    logger.info(`Syncing contests from ${platformName}...`);
    const results = await this.syncPlatformContests(adapter , status);
    logger.info(
      `${platformName} sync completed: ${results.new} new, ${results.updated} updated`
    );
    return results;
  }

  /**
   * Update contest statuses based on current time
   * @returns {Promise<Object>} Update results
   */
  async updateContestStatuses() {
    try {
      logger.info("Updating contest statuses...");
      const now = new Date();

      // Update upcoming contests that have started to "running"
      const startedContests = await Contest.updateMany(
        {
          status: "upcoming",
          startTime: { $lte: now },
        },
        {
          $set: { status: "running" },
        }
      );

      // Update running contests that have finished
      const contests = await Contest.find({
        status: "running",
      });

      let finishedCount = 0;
      for (const contest of contests) {
        const endTime = new Date(
          contest.startTime.getTime() + contest.duration * 60 * 1000
        );
        if (now >= endTime) {
          contest.status = "finished";
          await contest.save();
          finishedCount++;
        }
      }

      logger.info(
        `Status update completed: ${startedContests.modifiedCount} started, ${finishedCount} finished`
      );

      return {
        started: startedContests.modifiedCount,
        finished: finishedCount,
      };
    } catch (error) {
      logger.error(`Error updating contest statuses: ${error.message}`);
      throw error;
    }
  }
}

module.exports = new ContestSyncService();
