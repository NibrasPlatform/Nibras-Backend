const UserCompetitiveAccount = require("../models/userCompetitiveAccount.model");

class UserCompetitiveAccountRepository {
  async findByUserId(userId) {
    return UserCompetitiveAccount.findOne({ userId });
  }

  async findByPlatformIdentifier(platform, identifier) {
    const path =
      platform === "codeforces"
        ? "platforms.codeforces.handle"
        : `platforms.${platform}.username`;

    return UserCompetitiveAccount.findOne({ [path]: identifier.toLowerCase() });
  }

  async createIfMissing(userId) {
    return UserCompetitiveAccount.findOneAndUpdate(
      { userId },
      { $setOnInsert: { userId } },
      { returnDocument: "after", upsert: true },
    );
  }

  async upsertPlatformIdentifiers(userId, identifiers) {
    const update = {};

    if (Object.prototype.hasOwnProperty.call(identifiers, "codeforcesHandle")) {
      update["platforms.codeforces.handle"] = identifiers.codeforcesHandle
        ? identifiers.codeforcesHandle.toLowerCase()
        : null;
    }
    if (Object.prototype.hasOwnProperty.call(identifiers, "leetcodeUsername")) {
      update["platforms.leetcode.username"] = identifiers.leetcodeUsername
        ? identifiers.leetcodeUsername.toLowerCase()
        : null;
    }
    if (Object.prototype.hasOwnProperty.call(identifiers, "hackerrankUsername")) {
      update["platforms.hackerrank.username"] = identifiers.hackerrankUsername
        ? identifiers.hackerrankUsername.toLowerCase()
        : null;
    }

    return UserCompetitiveAccount.findOneAndUpdate(
      { userId },
      {
        $setOnInsert: { userId },
        $set: update,
      },
      { upsert: true, returnDocument: "after" },
    );
  }

  async setVerificationState(userId, platform, statePatch) {
    const $set = {};
    for (const [key, value] of Object.entries(statePatch)) {
      $set[`platforms.${platform}.verification.${key}`] = value;
    }

    return UserCompetitiveAccount.findOneAndUpdate(
      { userId },
      {
        $setOnInsert: { userId },
        $set,
      },
      { upsert: true, returnDocument: "after" },
    );
  }

  async setSyncState(userId, platform, syncPatch) {
    const $set = {};
    for (const [key, value] of Object.entries(syncPatch)) {
      $set[`platforms.${platform}.sync.${key}`] = value;
    }

    return UserCompetitiveAccount.findOneAndUpdate(
      { userId },
      {
        $setOnInsert: { userId },
        $set,
      },
      { upsert: true, returnDocument: "after" },
    );
  }

  async findExpiringVerifications(platform, thresholdDate) {
    return UserCompetitiveAccount.find({
      [`platforms.${platform}.verification.status`]: "verified",
      [`platforms.${platform}.verification.expiresAt`]: { $lte: thresholdDate },
    });
  }

  async findDueSyncAccounts(limit = 100) {
    const now = new Date();
    return UserCompetitiveAccount.find({
      $or: [
        {
          "platforms.codeforces.verification.status": "verified",
          $or: [
            { "platforms.codeforces.sync.nextSyncAt": { $lte: now } },
            { "platforms.codeforces.sync.nextSyncAt": null },
          ],
        },
        {
          "platforms.leetcode.verification.status": "verified",
          $or: [
            { "platforms.leetcode.sync.nextSyncAt": { $lte: now } },
            { "platforms.leetcode.sync.nextSyncAt": null },
          ],
        },
        {
          "platforms.hackerrank.verification.status": "verified",
          $or: [
            { "platforms.hackerrank.sync.nextSyncAt": { $lte: now } },
            { "platforms.hackerrank.sync.nextSyncAt": null },
          ],
        },
      ],
    }).limit(limit);
  }
}

module.exports = new UserCompetitiveAccountRepository();
