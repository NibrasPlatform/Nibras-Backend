class AppError extends Error {
  constructor(message, statusCode, statusText, errorCode = null, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.statusText = statusText;
    this.errorCode = errorCode;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }

  static create(message, statusCode, statusText, options = {}) {
    return new AppError(
      message,
      statusCode,
      statusText,
      options.errorCode || null,
      options.details || null
    );
  }
}

module.exports = AppError;
