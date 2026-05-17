const mongoose = require("mongoose");
const Vote = require("../models/vote.model.js");
const Question = require("../models/question.model.js");
const Answer = require("../models/answer.model.js");
const Thread = require("../models/thread.model.js");
const Post = require("../models/post.model.js");
const status = require("../../../core/constants/httpStatus");
const AppError = require("../../../core/utils/errorHandler");
const { emitVoteUpdated, emitVoteUpdatedForThread } = require("../../../realtime/events");
const activityEventService = require("../../gamification/services/activityEvent.service");
const notificationService = require("../../notifications/services/notification.service");

const getTargetModel = (targetType) => {
    if (targetType === "question") return Question;
    if (targetType === "answer")   return Answer;
    if (targetType === "thread")   return Thread;
    if (targetType === "post")     return Post;
    return null;
};

const castVote = async ({ userId, targetType, targetId, value }) => {
    const TargetModel = getTargetModel(targetType);
    if (!TargetModel) {
        const err = AppError.create("Invalid targetType", 400, status.Fail);
        throw err;
    }

    if (!mongoose.Types.ObjectId.isValid(targetId)) {
        const err = AppError.create("Invalid targetId", 400, status.Fail);
        throw err;
    }

    if (value !== 1 && value !== -1) {
        const err = AppError.create(
            "Invalid vote value. Must be 1 or -1",
            400,
            status.Fail
        );
        throw err;
    }

    const target = await TargetModel.findById(targetId).select("author question thread");
    if (!target) {
        const err = AppError.create(`${targetType} not found`, 404, status.Fail);
        throw err;
    }

    if (
        target.author &&
        String(target.author._id || target.author) === String(userId)
    ) {
        const err = AppError.create(
            "You cannot vote on your own content",
            403,
            status.Fail
        );
        throw err;
    }

    // Determine the room context for real-time emission
    let roomContextId;
    if (targetType === "question") roomContextId = target._id;
    else if (targetType === "answer") roomContextId = target.question;
    else if (targetType === "thread") roomContextId = target._id;
    else if (targetType === "post") roomContextId = target.thread;

    for (let attempt = 0; attempt < 2; attempt++) {
        const existing = await Vote.findOne({ user: userId, targetId, targetType });

        let action = "created";
        let delta = value;
        let userVoteValue = value;

        if (existing && existing.value === value) {
            action = "removed";
            delta = -value;
            userVoteValue = 0;
        } else if (existing) {
            action = "updated";
            delta = value - existing.value;
            userVoteValue = value;
        }

        try {
            if (!existing) {
                await Vote.create({ user: userId, targetId, targetType, value });
            } else if (action === "removed") {
                await existing.deleteOne();
            } else {
                existing.value = value;
                await existing.save();
            }

            const updatedTarget = await TargetModel.findByIdAndUpdate(
                targetId,
                { $inc: { votesCount: delta } },
                { returnDocument: 'after', select: "votesCount" }
            );

            if (!updatedTarget) {
                if (!existing) {
                    await Vote.deleteOne({ user: userId, targetId, targetType });
                } else if (action === "removed") {
                    await Vote.create({
                        user: userId,
                        targetId,
                        targetType,
                        value: existing.value,
                    });
                } else {
                    await Vote.updateOne(
                        { _id: existing._id },
                        { $set: { value: existing.value } }
                    );
                }

                const err = new Error(`${targetType} not found`);
                err.statusCode = 404;
                throw err;
            }

            if (roomContextId) {
                const votePayload = {
                    targetId,
                    targetType,
                    votesCount: updatedTarget.votesCount,
                };
                if (targetType === "question" || targetType === "answer") {
                    emitVoteUpdated(roomContextId, votePayload);
                } else {
                    emitVoteUpdatedForThread(roomContextId, votePayload);
                }
            }

            if ((action === "created" || (action === "updated" && value === 1)) && value === 1 && (targetType === "question" || targetType === "answer")) {
                let courseId = null;
                let questionId = null;
                let answerId = null;
                let threadId = null;

                if (targetType === "question") {
                    questionId = target._id;
                    const fullQuestion = await Question.findById(target._id).select("course");
                    courseId = fullQuestion?.course || null;
                } else if (targetType === "answer") {
                    answerId = target._id;
                    const fullQuestion = await Question.findById(target.question).select("course");
                    questionId = target.question || null;
                    courseId = fullQuestion?.course || null;
                } else if (targetType === "thread") {
                    threadId = target._id;
                    const fullThread = await Thread.findById(target._id).select("course");
                    courseId = fullThread?.course || null;
                }

                await activityEventService.recordVoteReward({
                    userId: target.author,
                    voteId: existing?._id || null,
                    voterId: userId,
                    targetType,
                    targetId: target._id,
                    questionId,
                    answerId,
                    threadId,
                    courseId,
                    occurredAt: new Date(),
                });
            }

            if (value === 1 && (action === "created" || action === "updated")) {
                await notificationService.notifyVote({
                    targetType,
                    targetId: target._id,
                    recipientId: target.author,
                    actorId: userId,
                });
            }

            return {
                action,
                voteValue: userVoteValue,
                votesCount: updatedTarget.votesCount,
            };
        } catch (err) {
            if (err && err.code === 11000 && attempt === 0) {
                continue;
            }
            throw err;
        }
    }
};

const getMyVote = async ({ userId, targetType, targetId }) => {
    const TargetModel = getTargetModel(targetType);
    if (!TargetModel) {
        const err = AppError.create("Invalid targetType", 400, status.Fail);
        throw err;
    }

    if (!mongoose.Types.ObjectId.isValid(targetId)) {
        const err = AppError.create("Invalid targetId", 400, status.Fail);
        throw err;
    }

    const vote = await Vote.findOne({ user: userId, targetId, targetType }).select(
        "value"
    );

    return { value: vote ? vote.value : 0 };
};

module.exports = { castVote, getMyVote };
