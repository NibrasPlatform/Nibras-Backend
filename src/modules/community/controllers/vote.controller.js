const catchAsync = require("../../../core/utils/catchAsync");
const AppError = require("../../../core/utils/errorHandler");
const voteService = require("../services/vote.service.js");

const castVote = catchAsync(async (req, res) => {
    const targetType = String(req.body.targetType || "").toLowerCase().trim();
    const targetId = String(req.body.targetId || "").trim();
    const value = Number(req.body.value);

    if (!targetType || !targetId || !Number.isFinite(value)) {
        throw AppError.create("targetType, targetId, and value are required", 400, "fail");
    }

    const result = await voteService.castVote({
        userId: req.user._id,
        targetType,
        targetId,
        value,
    });

    res.status(200).json({ success: true, message: "Vote processed successfully", data: result });
});

const getMyVote = catchAsync(async (req, res) => {
    const targetType = String(req.params.targetType || "").toLowerCase().trim();
    const targetId = String(req.params.targetId || "").trim();

    const result = await voteService.getMyVote({
        userId: req.user._id,
        targetType,
        targetId,
    });

    res.status(200).json({ success: true, message: "Vote fetched successfully", data: result });
});

module.exports = { castVote, getMyVote };
