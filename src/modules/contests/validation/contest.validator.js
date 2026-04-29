const { query, body } = require("express-validator");

const getContestsValidator = [
  query("platform")
    .optional()
    .isIn(["codeforces", "hackerrank", "leetcode"])
    .withMessage("Platform must be codeforces, hackerrank, or leetcode"),
  
  query("status")
    .optional()
    .isIn(["upcoming", "running", "finished"])
    .withMessage("Status must be upcoming, running, or finished"),
  
  query("bookmarked")
    .optional()
    .isBoolean()
    .withMessage("Bookmarked must be a boolean"),
  
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),
  
  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100"),
  
  query("sortBy")
    .optional()
    .isIn(["startTime", "duration", "title", "createdAt"])
    .withMessage("Invalid sort field"),
  
  query("order")
    .optional()
    .isIn(["asc", "desc"])
    .withMessage("Order must be asc or desc"),
];

const syncContestsValidator = [
  body("platform")
    .optional()
    .isIn(["codeforces", "hackerrank", "leetcode"])
    .withMessage("Platform must be codeforces, hackerrank, or leetcode"),
];

module.exports = {
  getContestsValidator,
  syncContestsValidator,
};
