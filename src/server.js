const http = require("http");

const app = require("./app");
const env = require("./core/config/env");
const logger = require("./core/utils/logger");
const connectDatabase = require("./core/config/database");
const { initSocket } = require("./realtime");
const { startAllJobs, stopAllJobs } = require("./jobs");

const startServer = async () => {
  await connectDatabase();

  const server = http.createServer(app);
  initSocket(server);

  server.listen(env.port, "0.0.0.0", () => {
    logger.info(`Server is running on port ${env.port}`);
    startAllJobs();
  });

  const gracefulShutdown = (signal) => {
    logger.warn(`${signal} received. Shutting down gracefully.`);
    stopAllJobs();
    server.close(() => process.exit(0));
  };

  process.on("SIGTERM", () => {
    gracefulShutdown("SIGTERM");
  });

  process.on("SIGINT", () => {
    gracefulShutdown("SIGINT");
  });

  process.on("unhandledRejection", (reason) => {
    logger.error("Unhandled promise rejection", { reason: reason?.message || String(reason) });
    gracefulShutdown("unhandledRejection");
  });

  process.on("uncaughtException", (error) => {
    logger.error("Uncaught exception", { message: error.message });
    gracefulShutdown("uncaughtException");
  });
};

startServer().catch((error) => {
  logger.error("Server startup failed", { message: error.message });
  process.exit(1);
});
