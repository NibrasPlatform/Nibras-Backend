const Contest = require("../models/contest.model");
const CodeforcesAdapter = require("./contests/contests-codeforcesAdapter");
const HackerRankAdapter = require("./contests/contests-hackerrankAdapter");
const LeetCodeAdapter = require("./contests/contests-leetcodeAdapter");
const logger = require("../../../core/utils/logger");

const CONCURRENCY_LIMIT = 10;

class ContestSyncService {
  constructor() {
    this.adapters = [
      new CodeforcesAdapter(),
      new HackerRankAdapter(),
      new LeetCodeAdapter(),
    ];
  }

  async syncAllContests() {
    logger.info("Starting contest sync from all platforms...");
    const startTime = Date.now();
    
    const results = {
      success: [],
      failed: [],
      total: 0,
      new: 0,
      updated: 0,
    };

    const platformPromises = this.adapters.map(async (adapter) => {
      try {
        const platformResults = await this.syncPlatformContests(adapter);
        return {
          platform: adapter.platformName,
          ...platformResults,
        };
      } catch (error) {
        logger.error(
          `Failed to sync ${adapter.platformName} contests: ${error.message}`
        );
        return {
          platform: adapter.platformName,
          error: error.message,
          failed: true
        };
      }
    });

    const platformResults = await Promise.all(platformPromises);
    
    for (const result of platformResults) {
      if (result.failed) {
        results.failed.push({
          platform: result.platform,
          error: result.error,
        });
      } else {
        results.success.push({
          platform: result.platform,
          total: result.total,
          new: result.new,
          updated: result.updated,
        });
        results.total += result.total;
        results.new += result.new;
        results.updated += result.updated;
      }
    }

    logger.info(
      `Contest sync completed in ${Date.now() - startTime}ms: ${results.new} new, ${results.updated} updated, ${results.failed.length} failed`
    );
    return results;
  }

  async syncPlatformContests(adapter, status) {
    const startTime = Date.now();
    try {
      const contests = await adapter.fetchContests(status);
      logger.info(`Fetched ${contests.length} contests from ${adapter.platformName} in ${Date.now() - startTime}ms`);

      const results = {
        total: contests.length,
        new: 0,
        updated: 0,
        skipped: 0,
      };

      const chunks = this.chunkArray(contests, CONCURRENCY_LIMIT);
      
      for (const chunk of chunks) {
        const chunkResults = await Promise.all(
          chunk.map((contestData) => this.saveContestSafe(contestData))
        );
        
        for (const result of chunkResults) {
          if (result === 'new') results.new++;
          else if (result === 'updated') results.updated++;
          else results.skipped++;
        }
      }

      logger.info(
        `Synced ${adapter.platformName} in ${Date.now() - startTime}ms: ${results.new} new, ${results.updated} updated`
      );
      return results;
    } catch (error) {
      logger.error(
        `Error syncing ${adapter.platformName} contests: ${error.message}`
      );
      throw error;
    }
  }

  chunkArray(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  async saveContestSafe(contestData) {
    try {
      return await this.saveContest(contestData, { new: 0, updated: 0 });
    } catch (error) {
      logger.error(
        `Error saving contest ${contestData.title}: ${error.message}`
      );
      return 'error';
    }
  }

  async saveContest(contestData, results) {
    const existingContest = await Contest.findOne({
      platform: contestData.platform,
      contestIdOnPlatform: contestData.contestIdOnPlatform,
    }).lean();

    if (existingContest) {
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
        return 'updated';
      }
    } else {
      const newContest = await Contest.create(contestData);
      if (newContest) {
        results.new++;
        return 'new';
      }
    }
    return 'skipped';
  }

  async syncPlatform(platformName, status) {
    const adapter = this.adapters.find(
      (a) => a.platformName.toLowerCase() === platformName.toLowerCase()
    );

    if (!adapter) {
      throw new Error(`Unknown platform: ${platformName}`);
    }

    logger.info(`Syncing contests from ${platformName}...`);
    const results = await this.syncPlatformContests(adapter, status);
    logger.info(
      `${platformName} sync completed: ${results.new} new, ${results.updated} updated`
    );
    return results;
  }

  async updateContestStatuses() {
    const startTime = Date.now();
    try {
      logger.info("Updating contest statuses...");
      const now = new Date();

      const startedContests = await Contest.updateMany(
        {
          status: "upcoming",
          startTime: { $lte: now },
        },
        {
          $set: { status: "running" },
        }
      );

      const contestsToUpdate = await Contest.find({
        status: "running",
      }).lean();

      if (contestsToUpdate.length === 0) {
        logger.info(`Status update completed in ${Date.now() - startTime}ms: 0 started, 0 finished`);
        return { started: startedContests.modifiedCount, finished: 0 };
      }

      const bulkOps = [];
      let finishedCount = 0;
      
      for (const contest of contestsToUpdate) {
        const endTime = new Date(
          new Date(contest.startTime).getTime() + contest.duration * 60 * 1000
        );
        if (now >= endTime) {
          bulkOps.push({
            updateOne: {
              filter: { _id: contest._id },
              update: { $set: { status: "finished" } },
            },
          });
          finishedCount++;
        }
      }

      if (bulkOps.length > 0) {
        await Contest.bulkWrite(bulkOps, { ordered: false });
      }

      logger.info(
        `Status update completed in ${Date.now() - startTime}ms: ${startedContests.modifiedCount} started, ${finishedCount} finished`
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
