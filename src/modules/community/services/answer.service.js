const Answer = require("../models/answer.model.js");
const Question = require("../models/question.model.js");
const AppError = require("../../../core/utils/errorHandler");
const status = require("../../../core/constants/httpStatus");
const { emitAnswerCreated } = require("../../../realtime/events");
const activityEventService = require("../../gamification/services/activityEvent.service");

const ALLOWED_CREATE_FIELDS = ["body", "author", "question", "isFromAI"];
const ALLOWED_UPDATE_FIELDS = ["body"];

const normalizePagination = (page, limit) => {
    const p = Math.max(Number(page) || 1, 1);
    const l = Math.min(Math.max(Number(limit) || 20, 1), 100);
    return { page: p, limit: l, skip: (p - 1) * l };
};

const createAnswer = async (data) => {
    const safeData = Object.fromEntries(
        Object.entries(data).filter(([key]) => ALLOWED_CREATE_FIELDS.includes(key))
    );

    const question = await Question.findById(data.question).lean();
    if (!question) {
        throw AppError.create("Question not found", 404, status.Fail);
    }

    const answer = await Answer.create(safeData);

    await Question.findByIdAndUpdate(answer.question, { $inc: { answersCount: 1 } });

    const populated = await Answer.findById(answer._id).populate("author");
    emitAnswerCreated(answer.question, populated);

    await activityEventService.recordAnswerCreated({
        userId: populated.author?._id || populated.author,
        answerId: populated._id,
        questionId: question._id,
        courseId: question.course || null,
        occurredAt: populated.createdAt,
        roleSnapshot: populated.author?.role?.name || null,
    });

    return populated;
};

const getAnswerById = async (id) => {
    return await Answer.findById(id).populate("author");
};

const updateAnswer = async (id, data) => {
    const safeData = Object.fromEntries(
        Object.entries(data).filter(([key]) => ALLOWED_UPDATE_FIELDS.includes(key))
    );

    return await Answer.findByIdAndUpdate(
        id,
        { ...safeData, updatedAt: Date.now() },
        { returnDocument: 'after' }
    ).populate("author");
};

const deleteAnswer = async (id) => {
    const answer = await Answer.findByIdAndDelete(id);

    if (answer && answer.question) {
        await Question.findByIdAndUpdate(answer.question, { $inc: { answersCount: -1 } });
    }

    return answer;
};

const getAnswersForQuestion = async (questionId, { page = 1, limit = 20 } = {}) => {
    const { page: p, limit: l, skip } = normalizePagination(page, limit);

    const [answers, total] = await Promise.all([
        Answer.find({ question: questionId })
            .populate("author")
            .sort({ isAccepted: -1, isPinned: -1, votesCount: -1, createdAt: -1 })
            .skip(skip)
            .limit(l),
        Answer.countDocuments({ question: questionId }),
    ]);

    return {
        answers,
        pagination: { page: p, limit: l, total, totalPages: Math.ceil(total / l) || 1 },
    };
};

const getAnswersForUser = async (userId, { page = 1, limit = 20 } = {}) => {
    const { page: p, limit: l, skip } = normalizePagination(page, limit);

    const [answers, total] = await Promise.all([
        Answer.find({ author: userId })
            .select("body")
            .sort({ votesCount: -1, createdAt: -1 })
            .skip(skip)
            .limit(l)
            .lean(),
        Answer.countDocuments({ author: userId }),
    ]);

    return {
        answers,
        pagination: { page: p, limit: l, total, totalPages: Math.ceil(total / l) || 1 },
    };
};

const acceptAnswer = async (answerId, questionAuthorId) => {
    const answer = await Answer.findById(answerId);
    if (!answer) {
        throw AppError.create("Answer not found", 404, status.Fail);
    }

    const question = await Question.findById(answer.question);
    if (!question) {
        throw AppError.create("Question not found", 404, status.Fail);
    }

    if (String(question.author) !== String(questionAuthorId)) {
        throw AppError.create("Only the question author can accept an answer", 403, status.Fail);
    }

    await Answer.updateMany(
        { question: answer.question, _id: { $ne: answerId } },
        { $set: { isAccepted: false } }
    );

    answer.isAccepted = true;
    await answer.save();

    await activityEventService.recordAcceptedAnswer({
        userId: answer.author,
        answerId: answer._id,
        questionId: question._id,
        courseId: question.course || null,
        occurredAt: new Date(),
    });

    return await Answer.findById(answerId).populate("author");
};

module.exports = {
    createAnswer,
    getAnswerById,
    updateAnswer,
    deleteAnswer,
    getAnswersForQuestion,
    getAnswersForUser,
    acceptAnswer,
};
