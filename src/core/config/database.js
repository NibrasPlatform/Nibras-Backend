const mongoose = require("mongoose");
const env = require("./env");
const logger = require("./logger");

const connectDatabase = async () => {
  if (!env.mongoUri) {
    throw new Error("DATABASE_URL (or MONGO_URI) is required.");
  }

  await mongoose.connect(env.mongoUri);
  logger.info("MongoDB connected successfully");
};

module.exports = connectDatabase;
