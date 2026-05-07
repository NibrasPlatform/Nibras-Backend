const Answer = require("../models/answer.model.js");
const Question = require("../models/question.model.js");
const AppError = require("../../../core/utils/errorHandler");
const status = require("../../../core/constants/httpStatus");
const { emitAnswerCreated } = require("../../../realtime/events");

const ALLOWED_CREATE_FIELDS = ["body", "author", "question", "isFromAI"];
const ALLOWED_UPDATE_FIELDS = ["body"];

const createAnswer = async (data) => {
    const safeData = Object.fromEntries(
        Object.entries(data).filter(([key]) => ALLOWED_CREATE_FIELDS.includes(key))
    );

    const question = await Question.findById(data.question);
    if (!question) {
        throw AppError.create("Question not found", 404, status.Fail);
    }

    const answer = await Answer.create(safeData);

    await Question.findByIdAndUpdate(answer.question, {
        $inc: { answersCount: 1 },
    });

    const populated = await Answer.findById(answer._id).populate("author");
    emitAnswerCreated(answer.question, populated);

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
        await Question.findByIdAndUpdate(answer.question, {
            $inc: { answersCount: -1 },
        });
    }

    return answer;
};

const getAnswersForQuestion = async (questionId) => {
    const answers = await Answer.find({ question: questionId })
        .populate("author")
        .sort({ createdAt: -1 });

    answers.sort((a, b) => {
        const aAccepted = a.isAccepted ? 1 : 0;
        const bAccepted = b.isAccepted ? 1 : 0;
        if (aAccepted !== bAccepted) return bAccepted - aAccepted;

        const aPinned = a.isPinned ? 1 : 0;
        const bPinned = b.isPinned ? 1 : 0;
        if (aPinned !== bPinned) return bPinned - aPinned;

        const aInstructor = a.author && a.author.role === "instructor" ? 1 : 0;
        const bInstructor = b.author && b.author.role === "instructor" ? 1 : 0;
        if (aInstructor !== bInstructor) return bInstructor - aInstructor;

        if (b.votesCount !== a.votesCount) return b.votesCount - a.votesCount;

        return b.createdAt - a.createdAt;
    });

    return answers;
};

const getAnswersForUser = async (userId) => {
    // return only body of answers
    return await Answer.find({ author: userId })
        .select("body")
        .sort({ votesCount: -1, createdAt: -1 });
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
