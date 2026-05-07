const CompetitiveProfileSnapshot = require("../models/competitiveProfileSnapshot.model");

class CompetitiveProfileSnapshotRepository {
  async findByUserId(userId) {
    return CompetitiveProfileSnapshot.findOne({ userId });
  }

  async upsertPlatformSnapshot(userId, platform, snapshot) {
    return CompetitiveProfileSnapshot.findOneAndUpdate(
      { userId },
      {
        $setOnInsert: { userId },
        $set: {
          [platform]: snapshot,
          lastAggregatedAt: new Date(),
        },
      },
      { upsert: true, returnDocument: "after" },
    );
  }

  async upsertBulk(userId, payload) {
    return CompetitiveProfileSnapshot.findOneAndUpdate(
      { userId },
      {
        $setOnInsert: { userId },
        $set: {
          ...payload,
          lastAggregatedAt: new Date(),
        },
      },
      { upsert: true, returnDocument: "after" },
    );
  }
}

module.exports = new CompetitiveProfileSnapshotRepository();
