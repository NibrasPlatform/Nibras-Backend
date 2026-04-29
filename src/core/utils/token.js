const jwt = require("jsonwebtoken");
const env = require("../config/env");

const generateToken = (payload, options = {}) => {
  if (!env.jwtSecret) {
    throw new Error("JWT_SECRET is required.");
  }

  const expiresIn = options.expiresIn || env.jwtExpire;
  return jwt.sign(payload, env.jwtSecret, { expiresIn });
};

const verifyToken = (token, options = {}) => {
  const secret = options.secret || env.jwtSecret;
  if (!secret) {
    throw new Error("JWT secret is required.");
  }
  return jwt.verify(token, secret);
};

module.exports = {
  generateToken,
  verifyToken,
};
