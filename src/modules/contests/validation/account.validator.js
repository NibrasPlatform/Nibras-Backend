const { body, param, query } = require("express-validator");
const AppError = require("../../../core/utils/errorHandler");

const platformValidator = body("platform")
  .isIn(["codeforces", "leetcode", "hackerrank"])
  .withMessage("platform must be one of codeforces, leetcode, hackerrank");

const linkAccountsValidator = [
  body("codeforcesHandle")
    .optional({ nullable: true })
    .isString()
    .withMessage("codeforcesHandle must be a string")
    .trim()
    .isLength({ min: 1, max: 64 })
    .withMessage("codeforcesHandle length must be between 1 and 64"),
  body("leetcodeUsername")
    .optional({ nullable: true })
    .isString()
    .withMessage("leetcodeUsername must be a string")
    .trim()
    .isLength({ min: 1, max: 64 })
    .withMessage("leetcodeUsername length must be between 1 and 64"),
  body("hackerrankUsername")
    .optional({ nullable: true })
    .isString()
    .withMessage("hackerrankUsername must be a string")
    .trim()
    .isLength({ min: 1, max: 64 })
    .withMessage("hackerrankUsername length must be between 1 and 64"),
  body()
    .custom((value, { req }) => {
      const keys = ["codeforcesHandle", "leetcodeUsername", "hackerrankUsername"];
      const hasAny = keys.some((key) => Object.prototype.hasOwnProperty.call(value || {}, key));
      if (!hasAny) {
        throw new AppError("At least one account field must be provided", 400);
      }
      return true;
    }),
];

const startVerificationValidator = [platformValidator];
const checkVerificationValidator = [platformValidator];

const getProfileValidator = [
  param("userId")
    .isMongoId()
    .withMessage("userId must be a valid Mongo ObjectId"),
];

const syncProfileValidator = [
  query("force")
    .optional()
    .isBoolean()
    .withMessage("force must be a boolean")
    .toBoolean(),
];

module.exports = {
  linkAccountsValidator,
  startVerificationValidator,
  checkVerificationValidator,
  getProfileValidator,
  syncProfileValidator,
};
