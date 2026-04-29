const answerService = require("../services/answer.service.js");
const AppError = require("../../../core/utils/errorHandler");
const status = require("../../../core/constants/httpStatus");
const mongoose = require('mongoose');

const createAnswer = async (req, res, next) => {
    try {
        const { body } = req.body;

        if (!body || !String(body).trim()) {
            return next(AppError.create("Answer body cannot be empty", 400, status.Fail));
        }

        if (!mongoose.Types.ObjectId.isValid(req.params.questionId)) {
            return next(AppError.create("Invalid question ID", 400, status.Fail));
        }

        const payload = {
            body: String(body).trim(),
            author: req.user._id,
            question: req.params.questionId,
        };

        const answer = await answerService.createAnswer(payload);
        res.status(201).json({ message: "Answer created successfully", answer });
    } catch (err) {
        next(AppError.create(err.message, err.statusCode || 500, status.Error));
    }
};

const getAnswersForQuestion = async (req, res, next) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.questionId)) {
            return next(AppError.create("Invalid question ID", 400, status.Fail));
        }

        const answers = await answerService.getAnswersForQuestion(req.params.questionId);
        res.status(200).json({ message: "Answers fetched successfully", answers });
    } catch (err) {
        next(AppError.create(err.message, 500, status.Error));
    }
};

const getAnswersForUser = async (req, res, next) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.userId)) {
            return next(AppError.create("Invalid user ID", 400, status.Fail));
        }

        const answers = await answerService.getAnswersForUser(req.params.userId);
        res.status(200).json({ message: "User comments fetched successfully", answers });
    } catch (err) {
        next(AppError.create(err.message, 500, status.Error));
    }
};

const getAnswerById = async (req, res, next) => {
    try {
        const answer = await answerService.getAnswerById(req.params.id);
        if (!answer) {
            return next(AppError.create("Answer not found", 404, status.Fail));
        }
        res.status(200).json({ message: "Answer fetched successfully", answer });
    } catch (err) {
        next(AppError.create(err.message, 500, status.Error));
    }
};

const updateAnswer = async (req, res, next) => {
    try {
        const { body } = req.body;

        if (body !== undefined && !String(body).trim()) {
            return next(AppError.create("Answer body cannot be empty", 400, status.Fail));
        }

        const answer = await answerService.getAnswerById(req.params.id);
        if (!answer) {
            return next(AppError.create("Answer not found", 404, status.Fail));
        }

        if (!req.user || String(answer.author._id || answer.author) !== String(req.user._id)) {
            return next(
                AppError.create(
                    "You are not allowed to update this answer",
                    403,
                    status.Fail
                )
            );
        }
        const payload = {};
        if (body !== undefined) payload.body = String(body).trim();

        const updatedAnswer = await answerService.updateAnswer(req.params.id, payload);
        res
            .status(200)
            .json({ message: "Answer updated successfully", answer: updatedAnswer });
    } catch (err) {
        next(AppError.create(err.message, 500, status.Error));
    }
};

const deleteAnswer = async (req, res, next) => {
    try {
        const answer = await answerService.getAnswerById(req.params.id);
        if (!answer) {
            return next(AppError.create("Answer not found", 404, status.Fail));
        }

        if (!req.user || String(answer.author._id || answer.author) !== String(req.user._id)) {
            return next(
                AppError.create(
                    "You are not allowed to delete this answer",
                    403,
                    status.Fail
                )
            );
        }

        await answerService.deleteAnswer(req.params.id);
        res.status(200).json({ message: "Answer deleted successfully" });
    } catch (err) {
        next(AppError.create(err.message, 500, status.Error));
    }
};

const acceptAnswer = async (req, res, next) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return next(AppError.create("Invalid answer ID", 400, status.Fail));
        }

        const answer = await answerService.acceptAnswer(req.params.id, req.user._id);
        res.status(200).json({ message: "Answer accepted successfully", answer });
    } catch (err) {
        next(AppError.create(err.message, err.statusCode || 500, status.Error));
    }
};

module.exports = {
    createAnswer,
    getAnswersForQuestion,
    getAnswersForUser,
    getAnswerById,
    updateAnswer,
    deleteAnswer,
    acceptAnswer,
};
