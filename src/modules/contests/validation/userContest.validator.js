const { param, query } = require("express-validator");

const contestIdValidator = [
  param("id")
    .isMongoId()
    .withMessage("Invalid contest ID"),
];

const paginationValidator = [
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),
  
  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100"),
];

const participationHistoryValidator = [
  query("platform")
    .optional()
    .isIn(["codeforces", "hackerrank", "leetcode"])
    .withMessage("Platform must be codeforces, hackerrank, or leetcode"),

  query("from")
    .optional()
    .isISO8601()
    .withMessage("from must be a valid ISO8601 date"),

  query("to")
    .optional()
    .isISO8601()
    .withMessage("to must be a valid ISO8601 date"),

  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),

  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100"),
];

module.exports = {
  contestIdValidator,
  paginationValidator,
  participationHistoryValidator,
};
