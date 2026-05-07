const { body, param, query } = require("express-validator");

const PLATFORMS = ["codeforces", "leetcode", "atcoder"];
const DIFFICULTIES = ["beginner", "newbie", "intermediate", "advanced"];

const titleValidator = body("title")
  .trim()
  .notEmpty()
  .withMessage("Title is required");

const platformValidator = body("platform")
  .optional()
  .isIn(PLATFORMS)
  .withMessage("Platform must be codeforces, leetcode, or atcoder");

const requiredUrlValidator = body("url")
  .exists({ checkFalsy: true })
  .withMessage("URL is required")
  .bail()
  .trim()
  .isURL({ require_protocol: true })
  .withMessage("URL must be a valid absolute URL");

const optionalUrlValidator = body("url")
  .optional()
  .trim()
  .isURL({ require_protocol: true })
  .withMessage("URL must be a valid absolute URL");

const difficultyValidator = body("difficulty")
  .isIn(DIFFICULTIES)
  .withMessage("Difficulty must be beginner, newbie, intermediate, or advanced");

const tagsValidator = body("tags")
  .isArray()
  .withMessage("Tags must be an array of strings");

const tagItemValidator = body("tags.*")
  .isString()
  .withMessage("Each tag must be a string")
  .bail()
  .trim()
  .notEmpty()
  .withMessage("Tags cannot contain empty values");

const ratingValidator = body("rating")
  .optional({ nullable: true })
  .isInt({ min: 0 })
  .withMessage("Rating must be a non-negative integer");

const isCoreValidator = body("isCore")
  .optional()
  .isBoolean()
  .withMessage("isCore must be a boolean");

const orderValidator = body("order")
  .optional()
  .isInt({ min: 0 })
  .withMessage("Order must be a non-negative integer");

const updateBodyValidator = body().custom((value, { req }) => {
  if (!req.body || Object.keys(req.body).length === 0) {
    throw new AppError("Request body cannot be empty", 400);
  }
  return true;
});

const createBodyFieldsValidator = body().custom((value, { req }) => {
  const AppError = require("../../../core/utils/errorHandler");
  const allowedFields = new Set(["url", "isCore", "order"]);
  const unexpectedFields = Object.keys(req.body || {}).filter((field) => !allowedFields.has(field));

  if (unexpectedFields.length > 0) {
    throw new AppError(`Unsupported fields in create payload: ${unexpectedFields.join(", ")}`, 400);
  }

  return true;
});

const createProblemValidator = [
  createBodyFieldsValidator,
  requiredUrlValidator,
  isCoreValidator,
  orderValidator,
];

const updateProblemValidator = [
  updateBodyValidator,
  body("title")
    .optional()
    .isString()
    .withMessage("Title must be a string")
    .bail()
    .trim()
    .notEmpty()
    .withMessage("Title cannot be empty"),
  body("platform")
    .optional()
    .isIn(PLATFORMS)
    .withMessage("Platform must be codeforces, leetcode, or atcoder"),
  optionalUrlValidator,
  body("difficulty")
    .optional()
    .isIn(DIFFICULTIES)
    .withMessage("Difficulty must be beginner, newbie, intermediate, or advanced"),
  body("tags")
    .optional()
    .isArray()
    .withMessage("Tags must be an array of strings"),
  body("tags.*")
    .optional()
    .isString()
    .withMessage("Each tag must be a string")
    .bail()
    .trim()
    .notEmpty()
    .withMessage("Tags cannot contain empty values"),
  ratingValidator,
  isCoreValidator,
  orderValidator,
];

const problemIdValidator = [
  param("id").isMongoId().withMessage("Invalid problem ID"),
];

const getProblemsValidator = [
  query("difficulty")
    .optional()
    .isIn(DIFFICULTIES)
    .withMessage("Difficulty must be beginner, newbie, intermediate, or advanced"),
  query("tags")
    .optional()
    .custom((value) => typeof value === "string" || Array.isArray(value))
    .withMessage("Tags filter must be a comma-separated string or repeated query values"),
];

const setSolvedStatusValidator = [
  body("solved").isBoolean().withMessage("solved must be a boolean").toBoolean(),
];

module.exports = {
  createProblemValidator,
  updateProblemValidator,
  problemIdValidator,
  getProblemsValidator,
  setSolvedStatusValidator,
  DIFFICULTIES,
};
