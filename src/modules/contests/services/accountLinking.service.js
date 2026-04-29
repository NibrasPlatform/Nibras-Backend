const AppError = require("../../../core/utils/errorHandler");
const status = require("../../../core/constants/httpStatus");
const userCompetitiveAccountRepository = require("./userCompetitiveAccount.repository");
const { PLATFORM_LIST } = require("../../../core/constants/competitivePlatforms");

class AccountLinkingService {
  async linkAccounts(userId, payload) {
    await userCompetitiveAccountRepository.createIfMissing(userId);

    const mappings = [
      { platform: "codeforces", value: payload.codeforcesHandle },
      { platform: "leetcode", value: payload.leetcodeUsername },
      { platform: "hackerrank", value: payload.hackerrankUsername },
    ];

    for (const item of mappings) {
      if (!Object.prototype.hasOwnProperty.call(payload, this.payloadKeyByPlatform(item.platform))) {
        continue;
      }
      if (!item.value) {
        continue;
      }

      const existing = await userCompetitiveAccountRepository.findByPlatformIdentifier(
        item.platform,
        item.value,
      );
      if (existing && String(existing.userId) !== String(userId)) {
        throw AppError.create(
          `${item.platform} account is already linked to another user`,
          409,
          status.Fail,
          { errorCode: "HANDLE_ALREADY_LINKED" },
        );
      }
    }

    const updated = await userCompetitiveAccountRepository.upsertPlatformIdentifiers(userId, payload);

    for (const platform of PLATFORM_LIST) {
      const payloadKey = this.payloadKeyByPlatform(platform);
      if (!Object.prototype.hasOwnProperty.call(payload, payloadKey)) {
        continue;
      }
      await userCompetitiveAccountRepository.setVerificationState(userId, platform, {
        status: "unverified",
        verifiedAt: null,
        expiresAt: null,
        lastCheckedAt: null,
        failureReason: null,
      });
    }

    return userCompetitiveAccountRepository.findByUserId(userId);
  }

  payloadKeyByPlatform(platform) {
    if (platform === "codeforces") return "codeforcesHandle";
    if (platform === "leetcode") return "leetcodeUsername";
    return "hackerrankUsername";
  }

  identifierFromDocument(accountDocument, platform) {
    if (platform === "codeforces") return accountDocument.platforms.codeforces.handle;
    return accountDocument.platforms[platform].username;
  }
}

module.exports = new AccountLinkingService();
