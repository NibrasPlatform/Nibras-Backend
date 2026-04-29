const express = require("express");
const router = express.Router();
const voteController = require("../controllers/vote.controller.js");
const authMiddleware = require("../../../core/middlewares/auth.middleware");
const status = require("../../../core/constants/httpStatus");
const AppError = require("../../../core/utils/errorHandler");

// POST /votes
router.post("/", authMiddleware.authenticate, voteController.castVote);

// GET /votes/:targetType/:targetId
router.get(
  "/:targetType/:targetId",
  authMiddleware.authenticate,
  voteController.getMyVote
);

router.all("", (req, res, next) => {
  next(AppError.create("Route not found", 404, status.Fail));
});

module.exports = router;
