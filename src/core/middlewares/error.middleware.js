const errorMiddleware = (err, req, res, next) => {
  const isDev = process.env.NODE_ENV === "development";

  // Mongoose CastError (bad ObjectId in URL params)
  if (err.name === "CastError") {
    return res.status(400).json({
      status: "fail",
      message: `Invalid ${err.path}: ${err.value}`,
    });
  }

  // Mongoose ValidationError (schema validation failures)
  if (err.name === "ValidationError") {
    const messages = Object.values(err.errors)
      .map((e) => e.message)
      .join(", ");
    return res.status(400).json({ status: "fail", message: messages });
  }

  // MongoDB duplicate key (code 11000)
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || "field";
    return res.status(409).json({
      status: "fail",
      message: `Duplicate value for ${field}`,
    });
  }

  const statusCode = err.statusCode || 500;
  const statusText = err.statusText || "error";

  res.status(statusCode).json({
    status: statusText,
    message: isDev ? err.message : "Something went wrong",
    code: err.errorCode || statusCode,
    details: isDev ? err.details || undefined : undefined,
  });
};

module.exports = errorMiddleware;
