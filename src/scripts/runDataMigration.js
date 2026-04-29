const mongoose = require("mongoose");
const env = require("../core/config/env");
const logger = require("../core/utils/logger");
const migrateLegacyUsers = require("./migrateLegacyUsers");
const reconcileLegacyReferences = require("./reconcileLegacyReferences");

const runDataMigration = async () => {
  await mongoose.connect(env.mongoUri);
  logger.info("Data migration started");

  await migrateLegacyUsers();
  await reconcileLegacyReferences();

  logger.info("Data migration finished");
  await mongoose.disconnect();
};

if (require.main === module) {
  runDataMigration().catch((error) => {
    logger.error("Data migration failed", { message: error.message });
    process.exit(1);
  });
}

module.exports = runDataMigration;
