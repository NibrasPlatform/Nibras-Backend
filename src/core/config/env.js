const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT || 3000),
  mongoUri: process.env.DATABASE_URL || process.env.MONGO_URI || "",
  serverUrl: process.env.SERVER_URL || "*",
  jwtSecret: process.env.JWT_SECRET || "",
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || "",
  jwtExpire: process.env.JWT_ACCESS_EXPIRATION || process.env.JWT_EXPIRE || "1d",
  jwtRefreshExpire: process.env.JWT_REFRESH_EXPIRATION || "7d",
};

const REQUIRED = ["DATABASE_URL", "JWT_SECRET", "JWT_REFRESH_SECRET"];
const missing = REQUIRED.filter((key) => !process.env[key]);
if (missing.length) {
  console.error(`FATAL: Missing required env vars: ${missing.join(", ")}`);
  process.exit(1);
}

module.exports = env;
