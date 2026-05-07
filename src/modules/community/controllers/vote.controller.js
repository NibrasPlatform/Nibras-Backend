const voteService = require("../services/vote.service.js");
const AppError = require("../../../core/utils/errorHandler");
const status = require("../../../core/constants/httpStatus");

const castVote = async (req, res, next) => {
  try {
    if (!req.user || !req.user._id) {
      return next(AppError.create("Unauthorized", 401, status.Fail));
    }
    
    const targetType = String(req.body.targetType || "").toLowerCase().trim();
    const targetId = String(req.body.targetId || "").trim();
    const value = Number(req.body.value);
     
    if (!targetType || !targetId || !Number.isFinite(value)) {
      return next(
        AppError.create(
          "targetType, targetId, and value are required",
          400,
          status.Fail
        )
      );
    }

    const result = await voteService.castVote({
      userId: req.user._id,
      targetType,
      targetId,
      value,
    });

    res.status(200).json({
      message: "Vote processed successfully",
      ...result,
    });
  } catch (err) {
    const statusCode = err.statusCode || 500;
    const statusText = statusCode >= 500 ? status.Error : status.Fail;
    next(AppError.create(err.message, statusCode, statusText));
  }
};

const getMyVote = async (req, res, next) => {
  try {
    if (!req.user || !req.user._id) {
      return next(AppError.create("Unauthorized", 401, status.Fail));
    }

    const targetType = String(req.params.targetType || "").toLowerCase().trim();
    const targetId = String(req.params.targetId || "").trim();

    const result = await voteService.getMyVote({
      userId: req.user._id,
      targetType,
      targetId,
    });

    res.status(200).json({
      message: "Vote fetched successfully",
      ...result,
    });
  } catch (err) {
    const statusCode = err.statusCode || 500;
    const statusText = statusCode >= 500 ? status.Error : status.Fail;
    next(AppError.create(err.message, statusCode, statusText));
  }
};

module.exports = { castVote, getMyVote };
