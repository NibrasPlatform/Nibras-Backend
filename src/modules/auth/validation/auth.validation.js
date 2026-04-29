const { body } = require("express-validator");

const registerValidator = [
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Name is required")
    .isLength({ min: 2, max: 100 })
    .withMessage("Name must be between 2 and 100 characters"),
  body("email")
    .trim()
    .isEmail()
    .withMessage("Invalid email format")
    .matches(/^[a-zA-Z0-9._%+-]+@gmail\.com$/i)
    .withMessage("Only @gmail.com emails are allowed"),
  body("password")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters"),
];

const loginValidator = [
  body("email")
    .trim()
    .isEmail()
    .withMessage("Invalid email format"),
  body("password")
    .notEmpty()
    .withMessage("Password is required"),
];

const refreshTokenValidator = [
  body("refreshToken")
    .notEmpty()
    .withMessage("Refresh token is required"),
];

const verifyOtpValidator = [
  body("email")
    .trim()
    .isEmail()
    .withMessage("Invalid email format"),
  body("otp")
    .notEmpty()
    .withMessage("OTP is required")
    .isLength({ min: 6, max: 6 })
    .withMessage("OTP must be exactly 6 digits"),
];

const googleLoginValidator = [
  body("idToken")
    .notEmpty()
    .withMessage("Google ID token is required"),
];

module.exports = {
  registerValidator,
  loginValidator,
  refreshTokenValidator,
  verifyOtpValidator,
  googleLoginValidator,
};
