const mongoose = require("mongoose");
const env = require("../core/config/env");
const logger = require("../core/utils/logger");

const migrateLegacyUsers = async () => {
  const usersCollection = mongoose.connection.collection("users");
  const studentsCollection = mongoose.connection.collection("students");

  const cursor = studentsCollection.find({});
  let migrated = 0;
  let skipped = 0;

  while (await cursor.hasNext()) {
    const student = await cursor.next();
    const existing = await usersCollection.findOne({ _id: student._id });
    if (existing) {
      skipped += 1;
      continue;
    }

    await usersCollection.insertOne({
      _id: student._id,
      name: student.name || student.fullName || "Unknown User",
      email: student.email,
      password: student.password,
      authProvider: student.authProvider || "manual",
      isVerified: Boolean(student.isVerified),
      role: student.role || null,
      reputationScore: student.reputationScore || 0,
      contestRating: student.contestRating || 0,
      problemsSolved: student.problemsSolved || 0,
      studyStreak: student.studyStreak || 0,
      createdAt: student.createdAt || new Date(),
      updatedAt: new Date(),
    });
    migrated += 1;
  }

  logger.info("Legacy student-to-user migration completed", { migrated, skipped });
};

const run = async () => {
  await mongoose.connect(env.mongoUri);
  await migrateLegacyUsers();
  await mongoose.disconnect();
};

if (require.main === module) {
  run().catch((error) => {
    logger.error("Legacy user migration failed", { message: error.message });
    process.exit(1);
  });
}

module.exports = migrateLegacyUsers;
