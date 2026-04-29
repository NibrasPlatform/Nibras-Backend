const AppError = require("../utils/errorHandler");

const notFoundMiddleware = (req, res, next) => {
  next(AppError.create("Route not found", 404, "fail"));
};

module.exports = notFoundMiddleware;
