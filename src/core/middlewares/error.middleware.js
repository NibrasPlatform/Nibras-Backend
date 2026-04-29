const errorMiddleware = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const statusText = err.statusText || "error";
  const isDev = process.env.NODE_ENV === "development";

  res.status(statusCode).json({
    status: statusText,
    message: isDev ? err.message : "Something went wrong",
    code: err.errorCode || statusCode,
    details: isDev ? err.details || undefined : undefined,
  });
};

module.exports = errorMiddleware;
