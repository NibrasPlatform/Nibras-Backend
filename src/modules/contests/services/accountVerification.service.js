const crypto = require("crypto");
const AppError = require("../../../core/utils/errorHandler");
const status = require("../../../core/constants/httpStatus");
const accountVerificationRepository = require("./accountVerification.repository");
const userCompetitiveAccountRepository = require("./userCompetitiveAccount.repository");
const { VERIFICATION_METHODS } = require("../../../core/constants/competitivePlatforms");
const codeforcesService = require("./codeforces.service");
const leetcodeService = require("./leetcode.service");
const hackerRankService = require("./hackerRank.service");

class AccountVerificationService {
  constructor() {
    this.tokenPrefix = "NIBRAS";
    this.pendingTokenMinutes = parseInt(process.env.VERIFICATION_PENDING_TTL_MINUTES || "15", 10);
    this.revalidationDays = parseInt(process.env.VERIFICATION_REVALIDATION_DAYS || "90", 10);
  }

  async startVerification(userId, platform) {
    const account = await userCompetitiveAccountRepository.findByUserId(userId);
    if (!account) {
      throw AppError.create("No linked accounts found", 404, status.Fail, {
        errorCode: "ACCOUNT_NOT_LINKED",
      });
    }

    const identifier = this.getIdentifier(account, platform);
    if (!identifier) {
      throw AppError.create(`No ${platform} account linked`, 400, status.Fail, {
        errorCode: "PLATFORM_NOT_LINKED",
      });
    }

    const token = this.generateToken();
    const tokenHash = this.hashToken(token);
    const expiresAt = new Date(Date.now() + this.pendingTokenMinutes * 60 * 1000);

    await accountVerificationRepository.supersedeActiveSessions(userId, platform);
    await accountVerificationRepository.createSession({
      userId,
      platform,
      accountIdentifier: identifier,
      method: VERIFICATION_METHODS[platform],
      token,
      tokenHash,
      status: "pending",
      expiresAt,
      metadata: {
        instruction: this.getInstruction(platform, token),
      },
    });

    await userCompetitiveAccountRepository.setVerificationState(userId, platform, {
      status: "pending",
      lastCheckedAt: null,
      failureReason: null,
    });

    return {
      platform,
      accountIdentifier: identifier,
      token,
      expiresAt,
      instruction: this.getInstruction(platform, token),
    };
  }

  async checkVerification(userId, platform) {
    const session = await accountVerificationRepository.findLatestPendingSession(userId, platform);
    if (!session) {
      throw AppError.create("No pending verification session found", 404, status.Fail, {
        errorCode: "VERIFICATION_NOT_STARTED",
      });
    }

    const now = new Date();
    if (now > session.expiresAt) {
      await accountVerificationRepository.markSessionResult(session._id, {
        status: "expired",
        completedAt: now,
        attempts: session.attempts + 1,
        failureReason: "Verification token expired",
      });
      await userCompetitiveAccountRepository.setVerificationState(userId, platform, {
        status: "expired",
        lastCheckedAt: now,
        failureReason: "Verification token expired",
      });
      throw AppError.create("Verification token expired", 410, status.Fail, {
        errorCode: "VERIFICATION_EXPIRED",
      });
    }

    if (session.attempts >= session.maxAttempts) {
      await accountVerificationRepository.markSessionResult(session._id, {
        status: "failed",
        completedAt: now,
        failureReason: "Maximum verification attempts reached",
      });
      await userCompetitiveAccountRepository.setVerificationState(userId, platform, {
        status: "failed",
        lastCheckedAt: now,
        failureReason: "Maximum verification attempts reached",
      });
      throw AppError.create("Maximum verification attempts reached", 429, status.Fail, {
        errorCode: "VERIFICATION_ATTEMPTS_EXCEEDED",
      });
    }
    const verificationResult = await this.verifyExternally(platform, session);

    if (!verificationResult.verified) {
      await accountVerificationRepository.markSessionResult(session._id, {
        attempts: session.attempts + 1,
        failureReason: "Verification evidence not found yet",
      });
      await userCompetitiveAccountRepository.setVerificationState(userId, platform, {
        status: "pending",
        lastCheckedAt: now,
        failureReason: "Verification evidence not found yet",
      });
      return {
        verified: false,
        message: "Verification evidence not found yet",
      };
    }

    const verifiedAt = new Date();
    const revalidationDate = new Date(
      verifiedAt.getTime() + this.revalidationDays * 24 * 60 * 60 * 1000,
    );

    await accountVerificationRepository.markSessionResult(session._id, {
      status: "verified",
      completedAt: verifiedAt,
      attempts: session.attempts + 1,
      failureReason: null,
      metadata: {
        ...session.metadata,
        evidence: verificationResult.evidence || null,
      },
      token: "[redacted]",
    });

    await userCompetitiveAccountRepository.setVerificationState(userId, platform, {
      status: "verified",
      verifiedAt,
      expiresAt: revalidationDate,
      lastCheckedAt: verifiedAt,
      failureReason: null,
    });

    return {
      verified: true,
      verifiedAt,
      expiresAt: revalidationDate,
      evidence: verificationResult.evidence || null,
    };
  }

  async expireDueVerifications() {
    const now = new Date();
    const platforms = ["codeforces", "leetcode", "hackerrank"];
    let expired = 0;

    for (const platform of platforms) {
      const accounts = await userCompetitiveAccountRepository.findExpiringVerifications(platform, now);
      for (const account of accounts) {
        await userCompetitiveAccountRepository.setVerificationState(account.userId, platform, {
          status: "expired",
          lastCheckedAt: now,
          failureReason: "Verification revalidation required",
        });
        expired += 1;
      }
    }

    return { expired };
  }

  async verifyExternally(platform, session) {
    if (platform === "codeforces") {
      return codeforcesService.verifyCompilationErrorSubmission(session.accountIdentifier, {
        startedAt: session.createdAt,
        expiresAt: session.expiresAt,
        preferredProblem: {
          contestId: 22,
          index: "A",
        },
      });
    }
    if (platform === "leetcode") {
      return leetcodeService.verifyBioToken(session.accountIdentifier, session.token);
    }
    return hackerRankService.verifyBioToken(session.accountIdentifier, session.token);
  }

  getIdentifier(account, platform) {
    if (platform === "codeforces") {
      return account.platforms?.codeforces?.handle || null;
    }
    return account.platforms?.[platform]?.username || null;
  }

  generateToken() {
    return `${this.tokenPrefix}_${crypto.randomBytes(6).toString("hex").toUpperCase()}`;
  }

  hashToken(token) {
    return crypto.createHash("sha256").update(token).digest("hex");
  }

  getInstruction(platform, token) {
    if (platform === "codeforces") {
      return "Submit code on Codeforces and get a COMPILATION_ERROR verdict between start and expiry time. Preferred problem: https://codeforces.com/contest/22/problem/A";
    }
    if (platform === "hackerrank") {
      return `Place the token "${token}" in your HackerRank profile bio/about section.`;
    }
    return `Place the token "${token}" in your public profile bio/description.`;
  }
}

module.exports = new AccountVerificationService();
