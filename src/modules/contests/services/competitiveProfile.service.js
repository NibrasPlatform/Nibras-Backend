const crypto = require("crypto");
const AppError = require("../../../core/utils/errorHandler");
const status = require("../../../core/constants/httpStatus");
const userCompetitiveAccountRepository = require("./userCompetitiveAccount.repository");
const competitiveProfileSnapshotRepository = require("./competitiveProfileSnapshot.repository");
const codeforcesService = require("./codeforces.service");
const leetcodeService = require("./leetcode.service");
const hackerRankService = require("./hackerRank.service");
const cacheService = require("./cache.service");
const progressCalculator = require("./progressCalculator.service");
const logger = require("../../../core/utils/logger");
const Problem = require("../../problems/models/problem.model");
const UserProblemProgress = require("../../problems/models/userProblemProgress.model");

class CompetitiveProfileService {
  constructor() {
    this.cacheTtlSeconds = parseInt(process.env.COMPETITIVE_PROFILE_CACHE_TTL_SECONDS || "7200", 10);
    this.syncIntervalHours = parseInt(process.env.COMPETITIVE_PROFILE_SYNC_INTERVAL_HOURS || "6", 10);
    this.manualSyncCooldownSeconds = parseInt(
      process.env.COMPETITIVE_PROFILE_MANUAL_SYNC_COOLDOWN_SECONDS || "60",
      10,
    );
    this.syncLockTtlSeconds = parseInt(process.env.COMPETITIVE_PROFILE_SYNC_LOCK_TTL_SECONDS || "120", 10);
    this.syncRateLimitMaxRequests = parseInt(
      process.env.COMPETITIVE_PROFILE_SYNC_MAX_REQUESTS_PER_MINUTE || "5",
      10,
    );
    this.syncRateLimitWindowSeconds = parseInt(
      process.env.COMPETITIVE_PROFILE_SYNC_RATE_WINDOW_SECONDS || "60",
      10,
    );
    this.syncFailureRetrySeconds = parseInt(
      process.env.COMPETITIVE_PROFILE_SYNC_FAILURE_RETRY_SECONDS || "300",
      10,
    );
    this.leetcodeCacheTtlSeconds = parseInt(process.env.LEETCODE_PROFILE_CACHE_TTL_SECONDS || "600", 10);
  }

  cacheKey(userId) {
    return `competitive-profile:${userId}`;
  }

  syncPayloadCacheKey(userId) {
    return `competitive-profile-sync:${userId}`;
  }

  syncLockKey(userId) {
    return `sync_lock_${userId}`;
  }

  syncRateKey(userId) {
    return `profile_sync_rate_${userId}`;
  }

  buildCodeforcesProblemKey(contestId, index) {
    if (!contestId || !index) {
      return null;
    }

    const parsedContestId = Number(contestId);
    if (!Number.isFinite(parsedContestId)) {
      return null;
    }

    return `${parsedContestId}:${String(index).toUpperCase()}`;
  }

  extractCodeforcesProblemKeyFromUrl(url) {
    if (!url) {
      return null;
    }

    try {
      const parsedUrl = new URL(url);
      const pathname = parsedUrl.pathname.replace(/\/+$/, "");
      const match = pathname.match(/^\/problemset\/problem\/(\d+)\/([A-Za-z0-9]+)$/i)
        || pathname.match(/^\/contest\/(\d+)\/problem\/([A-Za-z0-9]+)$/i);

      if (!match) {
        return null;
      }

      return this.buildCodeforcesProblemKey(match[1], match[2]);
    } catch (error) {
      return null;
    }
  }

  buildLeetcodeProblemKey(titleSlug) {
    if (!titleSlug) {
      return null;
    }

    const slug = String(titleSlug).trim().toLowerCase();
    return slug || null;
  }

  extractLeetcodeProblemKeyFromUrl(url) {
    if (!url) {
      return null;
    }

    try {
      const parsedUrl = new URL(url);
      const pathname = parsedUrl.pathname.replace(/\/+$/, "");
      const match = pathname.match(/^\/problems\/([a-z0-9-]+)$/i);
      if (!match) {
        return null;
      }
      return this.buildLeetcodeProblemKey(match[1]);
    } catch (error) {
      return null;
    }
  }

  async upsertSolvedProgress(userId, problemIds) {
    if (!Array.isArray(problemIds) || problemIds.length === 0) {
      return 0;
    }

    const solvedAt = new Date();
    await UserProblemProgress.bulkWrite(
      problemIds.map((problemId) => ({
        updateOne: {
          filter: { userId, problemId },
          update: {
            $set: {
              solved: true,
              solvedAt,
            },
          },
          upsert: true,
        },
      })),
      { ordered: false },
    );

    return problemIds.length;
  }

  async syncSolvedRoadmapProblemsCodeforces(userId, solvedProblemRefs) {
    if (!Array.isArray(solvedProblemRefs) || solvedProblemRefs.length === 0) {
      return {
        synced: 0,
        matchedProblems: 0,
      };
    }

    const solvedKeys = new Set(
      solvedProblemRefs
        .map((item) => this.buildCodeforcesProblemKey(item?.contestId, item?.index))
        .filter(Boolean),
    );

    if (solvedKeys.size === 0) {
      return {
        synced: 0,
        matchedProblems: 0,
      };
    }

    // Match against all Codeforces problems (not just roadmap core)
    const allProblems = await Problem.find({
      platform: "codeforces",
    })
      .select("_id url")
      .lean();

    const matchedProblemIds = allProblems
      .filter((problem) => {
        const key = this.extractCodeforcesProblemKeyFromUrl(problem.url);
        return key && solvedKeys.has(key);
      })
      .map((problem) => problem._id);

    if (matchedProblemIds.length === 0) {
      return {
        synced: 0,
        matchedProblems: 0,
      };
    }

    const synced = await this.upsertSolvedProgress(userId, matchedProblemIds);

    return {
      synced,
      matchedProblems: matchedProblemIds.length,
    };
  }

  async syncSolvedRoadmapProblemsLeetcode(userId, solvedProblemRefs) {
    if (!Array.isArray(solvedProblemRefs) || solvedProblemRefs.length === 0) {
      return {
        synced: 0,
        matchedProblems: 0,
      };
    }

    const solvedKeys = new Set(
      solvedProblemRefs
        .map((item) => this.buildLeetcodeProblemKey(item?.titleSlug))
        .filter(Boolean),
    );

    if (solvedKeys.size === 0) {
      return {
        synced: 0,
        matchedProblems: 0,
      };
    }

    // Match against all LeetCode problems (not just roadmap core)
    const allProblems = await Problem.find({
      platform: "leetcode",
    })
      .select("_id url")
      .lean();

    const matchedProblemIds = allProblems
      .filter((problem) => {
        const key = this.extractLeetcodeProblemKeyFromUrl(problem.url);
        return key && solvedKeys.has(key);
      })
      .map((problem) => problem._id);

    if (matchedProblemIds.length === 0) {
      return {
        synced: 0,
        matchedProblems: 0,
      };
    }

    const synced = await this.upsertSolvedProgress(userId, matchedProblemIds);

    return {
      synced,
      matchedProblems: matchedProblemIds.length,
    };
  }

  leetcodeCacheKey(userId) {
    return `leetcode_profile_${userId}`;
  }

  async getAggregatedProfile(userId) {
    const key = this.cacheKey(userId);
    const cached = await cacheService.get(key);
    if (cached) {
      return cached;
    }

    const account = await userCompetitiveAccountRepository.findByUserId(userId);
    if (!account) {
      throw AppError.create("Competitive account profile not found", 404, status.Fail, {
        errorCode: "PROFILE_NOT_FOUND",
      });
    }

    const snapshot = await competitiveProfileSnapshotRepository.findByUserId(userId);
    const payload = this.composeResponse(account, snapshot);
    await cacheService.set(key, payload, this.cacheTtlSeconds);
    return payload;
  }

  async refreshUserProfile(userId, platform = null) {
    const account = await userCompetitiveAccountRepository.findByUserId(userId);
    if (!account) {
      throw AppError.create("Competitive account profile not found", 404, status.Fail, {
        errorCode: "PROFILE_NOT_FOUND",
      });
    }

    const targetPlatforms = platform ? [platform] : ["codeforces", "leetcode", "hackerrank"];
    const snapshots = {};
    for (const p of targetPlatforms) {
      const identifier = this.getIdentifier(account, p);
      const verificationStatus = account.platforms?.[p]?.verification?.status;

      if (!identifier || verificationStatus !== "verified") {
        continue;
      }

      await userCompetitiveAccountRepository.setSyncState(userId, p, {
        syncStatus: "syncing",
      });

      try {
        const profile = await this.fetchPlatformProfile(p, identifier);
        const payloadHash = crypto.createHash("sha256").update(JSON.stringify(profile)).digest("hex");
        const snapshot = {
          ...profile,
          payloadHash,
          lastFetchedAt: new Date(),
        };

        snapshots[p] = snapshot;
        await competitiveProfileSnapshotRepository.upsertPlatformSnapshot(userId, p, snapshot);
        await userCompetitiveAccountRepository.setSyncState(userId, p, {
          syncStatus: "success",
          syncError: null,
          lastSyncedAt: new Date(),
          nextSyncAt: new Date(Date.now() + this.syncIntervalHours * 60 * 60 * 1000),
        });
      } catch (error) {
        await userCompetitiveAccountRepository.setSyncState(userId, p, {
          syncStatus: "failed",
          syncError: error.message,
          nextSyncAt: new Date(Date.now() + 60 * 60 * 1000),
        });
      }
    }

    await cacheService.del(this.cacheKey(userId));
    return snapshots;
  }

  async refreshDueProfiles(limit = 50) {
    const accounts = await userCompetitiveAccountRepository.findDueSyncAccounts(limit);
    let syncedUsers = 0;

    for (const account of accounts) {
      await this.refreshUserProfile(account.userId);
      syncedUsers += 1;
    }

    return { syncedUsers };
  }

  async syncProfileNow(userId, options = {}) {
    if (!cacheService.isEnabled()) {
      throw AppError.create("Sync service is unavailable", 503, status.Fail, {
        errorCode: "REDIS_REQUIRED",
      });
    }

    const force = Boolean(options.force);
    const rate = await cacheService.incrementWithWindow(
      this.syncRateKey(userId),
      this.syncRateLimitWindowSeconds,
    );
    if (rate.count > this.syncRateLimitMaxRequests) {
      throw AppError.create("Please wait before syncing again", 429, status.Fail, {
        errorCode: "TOO_MANY_REQUESTS",
        details: {
          retryAfterSeconds: Math.max(rate.ttlSeconds, 1),
        },
      });
    }

    const account = await userCompetitiveAccountRepository.findByUserId(userId);
    if (!account) {
      throw AppError.create("Competitive account profile not found", 404, status.Fail, {
        errorCode: "PROFILE_NOT_FOUND",
      });
    }

    const lastSyncedAt = this.getMostRecentSyncAt(account);
    if (!force && lastSyncedAt) {
      const elapsedSeconds = Math.floor((Date.now() - lastSyncedAt.getTime()) / 1000);
      if (elapsedSeconds < this.manualSyncCooldownSeconds) {
        const remainingSeconds = this.manualSyncCooldownSeconds - elapsedSeconds;
        throw AppError.create(
          `Please wait ${remainingSeconds} seconds before syncing again`,
          429,
          status.Fail,
          {
            errorCode: "SYNC_COOLDOWN_ACTIVE",
            details: { remainingSeconds },
          },
        );
      }
    }

    const lockKey = this.syncLockKey(userId);
    const lockAcquired = await cacheService.setIfNotExists(lockKey, "1", this.syncLockTtlSeconds);
    if (!lockAcquired) {
      throw AppError.create("Sync already in progress", 409, status.Fail, {
        errorCode: "SYNC_IN_PROGRESS",
      });
    }

    const startedAt = Date.now();
    try {
      const syncablePlatforms = this.getSyncablePlatforms(account);
      if (syncablePlatforms.length === 0) {
        throw AppError.create("No verified competitive accounts available for sync", 400, status.Fail, {
          errorCode: "NO_VERIFIED_ACCOUNTS",
        });
      }

      await Promise.all(
        syncablePlatforms.map(({ platform }) =>
          userCompetitiveAccountRepository.setSyncState(userId, platform, {
            syncStatus: "syncing",
            syncError: null,
          })),
      );

      const fetchResults = await Promise.all(
        syncablePlatforms.map(({ platform, identifier }) =>
          this.fetchPlatformProfileSafe(userId, platform, identifier)),
      );
      const leetcodeResult = fetchResults.find((entry) => entry.platform === "leetcode") || null;

      const syncTimestamp = new Date();
      const snapshotPatch = {};
      const stateUpdates = [];
      const syncPayloadProfiles = {
        codeforces: null,
        leetcode: {
          data: null,
          error: null,
          stale: false,
        },
        hackerrank: null,
      };

      for (const result of fetchResults) {
        const { platform } = result;
        if (result.success && result.profile) {
          snapshotPatch[platform] = {
            ...result.profile,
            payloadHash: crypto.createHash("sha256").update(JSON.stringify(result.profile)).digest("hex"),
            lastFetchedAt: syncTimestamp,
          };
          stateUpdates.push(
            userCompetitiveAccountRepository.setSyncState(userId, platform, {
              syncStatus: "success",
              syncError: null,
              lastSyncedAt: syncTimestamp,
              nextSyncAt: new Date(Date.now() + this.syncIntervalHours * 60 * 60 * 1000),
            }),
          );
        } else {
          stateUpdates.push(
            userCompetitiveAccountRepository.setSyncState(userId, platform, {
              syncStatus: "failed",
              syncError: result.error,
              nextSyncAt: new Date(Date.now() + this.syncFailureRetrySeconds * 1000),
            }),
          );
          logger.warn("Platform sync failure", {
            userId: String(userId),
            platform,
            error: result.error,
            rawError: result.rawError?.message,
          });
        }
        if (platform === "leetcode") {
          syncPayloadProfiles.leetcode = {
            data: result.syncData,
            error: result.error,
            stale: Boolean(result.stale),
          };
          continue;
        }

        if (result.success && result.profile) {
          syncPayloadProfiles[platform] = result.profile;
        }
      }

      await Promise.all(stateUpdates);

      const hasSnapshotUpdates = Object.keys(snapshotPatch).length > 0;
      let snapshot = await competitiveProfileSnapshotRepository.findByUserId(userId);
      if (hasSnapshotUpdates) {
        snapshot = await competitiveProfileSnapshotRepository.upsertBulk(userId, snapshotPatch);
      }

      if (!syncPayloadProfiles.codeforces) {
        syncPayloadProfiles.codeforces = snapshot?.codeforces || null;
      }
      if (!syncPayloadProfiles.hackerrank) {
        syncPayloadProfiles.hackerrank = snapshot?.hackerrank || null;
      }
      if (!syncPayloadProfiles.leetcode.data) {
        syncPayloadProfiles.leetcode.data = this.normalizeLeetcodeFromSnapshot(snapshot?.leetcode || null);
        if (leetcodeResult && !leetcodeResult.success && syncPayloadProfiles.leetcode.data) {
          syncPayloadProfiles.leetcode.stale = true;
        }
      }

      const stale = fetchResults.length > 0 && fetchResults.every((entry) => !entry.success);
      const codeforcesResult = fetchResults.find((entry) => entry.platform === "codeforces");
      const leetcodePlatformResult = fetchResults.find((entry) => entry.platform === "leetcode");
      
      // Sync all solved problems from both platforms
      const codeforcesSync = await this.syncSolvedRoadmapProblemsCodeforces(
        userId,
        codeforcesResult?.profile?.solvedProblemRefs || [],
      );
      const leetcodeSync = await this.syncSolvedRoadmapProblemsLeetcode(
        userId,
        leetcodePlatformResult?.profile?.solvedProblemRefs || [],
      );
      
      // Calculate overall user progress after sync
      const userProgress = await progressCalculator.calculateUserProgress(userId);
      
      const problemSyncStats = {
        codeforces: codeforcesSync,
        leetcode: leetcodeSync,
        totalSynced: codeforcesSync.synced + leetcodeSync.synced,
      };
      const responsePayload = {
        profiles: syncPayloadProfiles,
        lastSyncedAt: snapshot?.lastAggregatedAt || null,
        stale,
        problemSync: problemSyncStats,
        progress: userProgress,
      };

      await Promise.all([
        cacheService.set(this.syncPayloadCacheKey(userId), responsePayload, this.cacheTtlSeconds),
        cacheService.set(
          this.cacheKey(userId),
          this.composeResponse(account, snapshot),
          this.cacheTtlSeconds,
        ),
      ]);

      logger.info("Competitive profile sync completed", {
        userId: String(userId),
        durationMs: Date.now() - startedAt,
        platforms: syncablePlatforms.map((entry) => entry.platform),
        stale,
      });

      return responsePayload;
    } finally {
      try {
        await cacheService.del(lockKey);
      } catch (error) {
        logger.warn("Failed to release sync lock", {
          userId: String(userId),
          message: error.message,
        });
      }
    }
  }

  composeResponse(account, snapshot) {
    const deprecatedAtcoder = this.getDeprecatedAtcoder(account, snapshot);

    const response = {
      userId: account.userId,
      linkedAccounts: {
        codeforces: account.platforms?.codeforces?.handle || null,
        leetcode: account.platforms?.leetcode?.username || null,
        hackerrank: account.platforms?.hackerrank?.username || null,
      },
      verification: {
        codeforces: account.platforms?.codeforces?.verification || null,
        leetcode: account.platforms?.leetcode?.verification || null,
        hackerrank: account.platforms?.hackerrank?.verification || null,
      },
      sync: {
        codeforces: account.platforms?.codeforces?.sync || null,
        leetcode: account.platforms?.leetcode?.sync || null,
        hackerrank: account.platforms?.hackerrank?.sync || null,
      },
      profile: snapshot
        ? {
            codeforces: snapshot.codeforces,
            leetcode: this.toLeetcodeProfilePayload(snapshot.leetcode),
            hackerrank: this.toHackerRankProfilePayload(snapshot.hackerrank),
            lastAggregatedAt: snapshot.lastAggregatedAt,
          }
        : {
            codeforces: null,
            leetcode: null,
            hackerrank: null,
            lastAggregatedAt: null,
          },
    };

    if (deprecatedAtcoder) {
      response.deprecated = {
        atcoder: deprecatedAtcoder,
      };
    }

    return response;
  }

  toHackerRankProfilePayload(snapshot) {
    if (!snapshot) {
      return null;
    }
    return {
      ...snapshot,
      solvedCount: Number.isFinite(snapshot.solvedCount) ? snapshot.solvedCount : 0,
      badges: Array.isArray(snapshot.badges) ? snapshot.badges : [],
      lastSyncedAt: snapshot.lastFetchedAt || null,
    };
  }

  toLeetcodeProfilePayload(snapshot) {
    if (!snapshot) {
      return null;
    }
    const normalized = leetcodeService.normalizeSyncData(snapshot);
    return {
      ...normalized,
      lastSyncedAt: snapshot.lastFetchedAt || null,
    };
  }

  getIdentifier(account, platform) {
    if (platform === "codeforces") {
      return account.platforms?.codeforces?.handle || null;
    }
    return account.platforms?.[platform]?.username || null;
  }

  getMostRecentSyncAt(account) {
    const timestamps = ["codeforces", "leetcode", "hackerrank"]
      .map((platform) => account.platforms?.[platform]?.sync?.lastSyncedAt)
      .filter(Boolean)
      .map((value) => new Date(value));

    if (timestamps.length === 0) {
      return null;
    }
    return timestamps.reduce((latest, current) => (current > latest ? current : latest));
  }

  getSyncablePlatforms(account) {
    const platforms = ["codeforces", "leetcode", "hackerrank"];
    return platforms
      .map((platform) => ({
        platform,
        identifier: this.getIdentifier(account, platform),
        verified: account.platforms?.[platform]?.verification?.status === "verified",
      }))
      .filter((entry) => entry.identifier && entry.verified);
  }

  async fetchPlatformProfileSafe(userId, platform, identifier) {
    if (platform !== "leetcode") {
      try {
        const profile = await this.fetchPlatformProfile(platform, identifier);
        return {
          platform,
          success: true,
          profile,
          syncData: null,
          error: null,
          stale: false,
        };
      } catch (error) {
        return {
          platform,
          success: false,
          profile: null,
          syncData: null,
          error: error.message,
          stale: false,
        };
      }
    }

    try {
      const profile = await this.fetchPlatformProfile("leetcode", identifier);
      const normalized = leetcodeService.normalizeSyncData(profile);
      await cacheService.set(
        this.leetcodeCacheKey(userId),
        {
          data: normalized,
          error: null,
          stale: false,
        },
        this.leetcodeCacheTtlSeconds,
      );
      return {
        platform,
        success: true,
        profile,
        syncData: normalized,
        error: null,
        stale: false,
      };
    } catch (error) {
      const cached = await cacheService.get(this.leetcodeCacheKey(userId));
      if (cached?.data) {
        return {
          platform,
          success: false,
          profile: null,
          syncData: leetcodeService.normalizeSyncData(cached.data),
          error: this.classifyLeetcodeError(error),
          rawError: error,
          stale: true,
        };
      }

      return {
        platform,
        success: false,
        profile: null,
        syncData: null,
        error: this.classifyLeetcodeError(error),
        rawError: error,
        stale: false,
      };
    }
  }

  classifyLeetcodeError(error) {
    if (!error) {
      return "unknown_error";
    }

    if (error.errorCode === "LEETCODE_TIMEOUT") {
      return "timeout";
    }

    if (error.errorCode === "PLATFORM_ACCOUNT_NOT_FOUND") {
      return "not_found";
    }

    if (error.message?.includes("400") || error.errorCode === "LEETCODE_BAD_REQUEST") {
      return "bad_request";
    }

    return "unknown_error";
  }

  normalizeLeetcodeFromSnapshot(snapshot) {
    if (!snapshot) {
      return null;
    }
    return leetcodeService.normalizeSyncData(snapshot);
  }

  getDeprecatedAtcoder(account, snapshot) {
    const accountObject = typeof account?.toObject === "function" ? account.toObject() : account;
    const snapshotObject = typeof snapshot?.toObject === "function" ? snapshot.toObject() : snapshot;
    const accountAtcoder = accountObject?.platforms?.atcoder || null;
    const snapshotAtcoder = snapshotObject?.atcoder || null;

    if (!accountAtcoder && !snapshotAtcoder) {
      return null;
    }

    return {
      linkedAccount: accountAtcoder?.username || null,
      verification: accountAtcoder?.verification || null,
      sync: accountAtcoder?.sync || null,
      profile: snapshotAtcoder || null,
      deprecated: true,
    };
  }

  async fetchPlatformProfile(platform, identifier) {
    if (platform === "codeforces") return codeforcesService.fetchCompetitiveProfile(identifier);
    if (platform === "leetcode") return leetcodeService.fetchCompetitiveProfile(identifier);
    return hackerRankService.fetchCompetitiveProfile(identifier);
  }
}

module.exports = new CompetitiveProfileService();
