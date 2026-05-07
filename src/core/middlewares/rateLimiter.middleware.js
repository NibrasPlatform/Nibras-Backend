const AppError = require("../utils/errorHandler");
const status = require("../constants/httpStatus");

class RateLimiter {
  constructor() {
    this.requests = new Map();
  }

  middleware(maxRequests = 10, windowMs = 60_000) {
    return (req, res, next) => {
      const key = req.user?.id || req.ip;
      if (!this.requests.has(key)) {
        this.requests.set(key, []);
      }

      const now = Date.now();
      const requestTimestamps = this.requests
        .get(key)
        .filter((timestamp) => now - timestamp < windowMs);

      if (requestTimestamps.length >= maxRequests) {
        return next(
          AppError.create(
            `Too many requests. Try again after ${Math.ceil(
              (windowMs - (now - requestTimestamps[0])) / 1000
            )} seconds`,
            status.TOO_MANY_REQUESTS,
            status.Fail
          )
        );
      }

      requestTimestamps.push(now);
      this.requests.set(key, requestTimestamps);
      return next();
    };
  }
}

module.exports = new RateLimiter();
