const AccountVerification = require("../models/accountVerification.model");

class AccountVerificationRepository {
  async supersedeActiveSessions(userId, platform) {
    return AccountVerification.updateMany(
      {
        userId,
        platform,
        status: "pending",
      },
      {
        $set: {
          status: "superseded",
          completedAt: new Date(),
          failureReason: "Superseded by newer verification token",
        },
      },
    );
  }

  async createSession(payload) {
    return AccountVerification.create(payload);
  }

  async findLatestPendingSession(userId, platform) {
    return AccountVerification.findOne({
      userId,
      platform,
      status: "pending",
    })
      .select("+token")
      .sort({ createdAt: -1 });
  }

  async markSessionResult(sessionId, patch) {
    return AccountVerification.findByIdAndUpdate(
      sessionId,
      {
        $set: patch,
      },
      { returnDocument: "after" },
    );
  }
}

module.exports = new AccountVerificationRepository();
