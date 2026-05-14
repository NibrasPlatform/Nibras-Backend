const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../../.env") });

const mongoose = require("mongoose");
const connectDatabase = require("../core/config/database");
const logger = require("../core/utils/logger");
const User = require("../modules/users/models/user.model");
const gamificationService = require("../modules/gamification/services/gamification.service");

const main = async () => {
  await connectDatabase();

  const users = await User.find().select("_id").lean();
  let processed = 0;
  for (const user of users) {
    await gamificationService.syncUserReputationScore(user._id);
    processed += 1;
  }

  logger.info("Reputation snapshot backfill completed", { processed });
  await mongoose.connection.close();
};

main().catch(async (error) => {
  logger.error("Reputation snapshot backfill failed", { message: error.message });
  try {
    await mongoose.connection.close();
  } catch (_) {
    // ignore shutdown errors
  }
  process.exit(1);
});
