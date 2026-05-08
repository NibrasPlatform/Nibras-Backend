const catchAsync = require("../../../core/utils/catchAsync");
const AppError = require("../../../core/utils/errorHandler");
const answerService = require("../services/answer.service.js");
const mongoose = require("mongoose");

const createAnswer = catchAsync(async (req, res) => {
    const { body } = req.body;

    if (!body || !String(body).trim()) {
        throw AppError.create("Answer body cannot be empty", 400, "fail");
    }

    if (!mongoose.Types.ObjectId.isValid(req.params.questionId)) {
        throw AppError.create("Invalid question ID", 400, "fail");
    }

    const payload = {
        body: String(body).trim(),
        author: req.user._id,
        question: req.params.questionId,
    };

    const answer = await answerService.createAnswer(payload);
    res.status(201).json({ success: true, message: "Answer created successfully", data: { answer } });
});

const getAnswersForQuestion = catchAsync(async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.questionId)) {
        throw AppError.create("Invalid question ID", 400, "fail");
    }

    const { answers, pagination } = await answerService.getAnswersForQuestion(req.params.questionId, {
        page: req.query.page,
        limit: req.query.limit,
    });
    res.status(200).json({ success: true, message: "Answers fetched successfully", data: { answers, pagination } });
});

const getAnswersForUser = catchAsync(async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.userId)) {
        throw AppError.create("Invalid user ID", 400, "fail");
    }

    const { answers, pagination } = await answerService.getAnswersForUser(req.params.userId, {
        page: req.query.page,
        limit: req.query.limit,
    });
    res.status(200).json({ success: true, message: "User answers fetched successfully", data: { answers, pagination } });
});

const getAnswerById = catchAsync(async (req, res) => {
    const answer = await answerService.getAnswerById(req.params.id);
    if (!answer) throw AppError.create("Answer not found", 404, "fail");
    res.status(200).json({ success: true, message: "Answer fetched successfully", data: { answer } });
});

const updateAnswer = catchAsync(async (req, res) => {
    const { body } = req.body;

    if (body !== undefined && !String(body).trim()) {
        throw AppError.create("Answer body cannot be empty", 400, "fail");
    }

    const answer = await answerService.getAnswerById(req.params.id);
    if (!answer) throw AppError.create("Answer not found", 404, "fail");

    const authorId = answer.author._id || answer.author;
    if (String(authorId) !== String(req.user._id)) {
        throw AppError.create("You are not allowed to update this answer", 403, "fail");
    }

    const payload = {};
    if (body !== undefined) payload.body = String(body).trim();

    const updatedAnswer = await answerService.updateAnswer(req.params.id, payload);
    res.status(200).json({ success: true, message: "Answer updated successfully", data: { answer: updatedAnswer } });
});

const deleteAnswer = catchAsync(async (req, res) => {
    const answer = await answerService.getAnswerById(req.params.id);
    if (!answer) throw AppError.create("Answer not found", 404, "fail");

    const authorId = answer.author._id || answer.author;
    if (String(authorId) !== String(req.user._id)) {
        throw AppError.create("You are not allowed to delete this answer", 403, "fail");
    }

    await answerService.deleteAnswer(req.params.id);
    res.status(200).json({ success: true, message: "Answer deleted successfully" });
});

const acceptAnswer = catchAsync(async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        throw AppError.create("Invalid answer ID", 400, "fail");
    }

    const answer = await answerService.acceptAnswer(req.params.id, req.user._id);
    res.status(200).json({ success: true, message: "Answer accepted successfully", data: { answer } });
});

module.exports = {
    createAnswer,
    getAnswersForQuestion,
    getAnswersForUser,
    getAnswerById,
    updateAnswer,
    deleteAnswer,
    acceptAnswer,
};
