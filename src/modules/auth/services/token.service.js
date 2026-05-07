let httpStatus = require("http-status");
if (httpStatus.default) httpStatus = httpStatus.default;

const jwt = require("jsonwebtoken");
const ms = require("ms");
const env = require("../../../core/config/env");
const Token = require("../models/token.model");

const createServiceError = (statusCode, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.isOperational = true;
  return error;
};

const signToken = ({ payload, secret, expiresIn, unavailableMessage }) => {
  if (!secret) {
    throw createServiceError(
      httpStatus.INTERNAL_SERVER_ERROR,
      unavailableMessage || "JWT secret is missing in your environment."
    );
  }
  return jwt.sign(payload, secret, { expiresIn });
};

const generateAuthTokens = async (student) => {
  const accessTokenExpiresIn = env.jwtExpire;
  const refreshTokenExpiresIn = env.jwtRefreshExpire;

  const accessToken = signToken({
    payload: { id: student._id, roleName: student.role?.name },
    secret: env.jwtSecret,
    expiresIn: accessTokenExpiresIn,
  });

  const refreshToken = signToken({
    payload: { id: student._id, type: "refresh" },
    secret: env.jwtRefreshSecret,
    expiresIn: refreshTokenExpiresIn,
  });

  const refreshTokenExpiresDate = new Date(Date.now() + ms(refreshTokenExpiresIn));

  await Token.create({
    token: refreshToken,
    user: student._id,
    type: "refresh",
    expires: refreshTokenExpiresDate,
    blacklisted: false,
  });

  return {
    access: {
      token: accessToken,
      expiresIn: accessTokenExpiresIn,
    },
    refresh: {
      token: refreshToken,
      expiresIn: refreshTokenExpiresIn,
    },
  };
};

const verifyRefreshToken = (refreshToken) => {
  if (!env.jwtRefreshSecret) {
    throw createServiceError(httpStatus.INTERNAL_SERVER_ERROR, "Refresh secret missing.");
  }
  try {
    return jwt.verify(refreshToken, env.jwtRefreshSecret);
  } catch (error) {
    throw createServiceError(httpStatus.UNAUTHORIZED, "Invalid or expired refresh token.");
  }
};

module.exports = {
  generateAuthTokens,
  verifyRefreshToken,
};
