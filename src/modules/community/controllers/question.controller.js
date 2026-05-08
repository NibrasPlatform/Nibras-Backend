const catchAsync = require("../../../core/utils/catchAsync");
const AppError = require("../../../core/utils/errorHandler");
const questionService = require('../services/question.service.js');
const answerService = require('../services/answer.service.js');
const status = require("../../../core/constants/httpStatus");

const createQuestion = catchAsync(async (req, res) => {
    const { title, body, tags, course } = req.body;

    if (!title || !String(title).trim()) {
        throw AppError.create('Title is required', 400, status.Fail);
    }
    if (!body || !String(body).trim()) {
        throw AppError.create('Body is required', 400, status.Fail);
    }

    const payload = {
        title: String(title).trim(),
        body: String(body).trim(),
        tags: tags || [],
        course,
        author: req.user._id,
    };

    const question = await questionService.createQuestion(payload);
    res.status(201).json({ success: true, message: 'Question created successfully', data: { question } });
});

const getQuestions = catchAsync(async (req, res) => {
    const result = await questionService.getQuestions({
        search: req.query.search,
        title: req.query.title,
        tag: req.query.tag,
        course: req.query.course,
        page: req.query.page,
        limit: req.query.limit,
    });
    res.status(200).json({ success: true, message: 'Questions fetched successfully', data: result });
});

const getSingleQuestion = catchAsync(async (req, res) => {
    const question = await questionService.getQuestionById(req.params.id);
    if (!question) throw AppError.create('Question not found', 404, status.Fail);

    const { answers, pagination: answerPagination } = await answerService.getAnswersForQuestion(req.params.id);

    res.status(200).json({
        success: true,
        message: 'Question fetched successfully',
        data: { question, answers, answerPagination },
    });
});

const updateQuestion = catchAsync(async (req, res) => {
    const question = await questionService.getQuestionById(req.params.id);
    if (!question) throw AppError.create('Question not found', 404, status.Fail);

    const authorId = question.author._id || question.author;
    if (String(authorId) !== String(req.user._id)) {
        throw AppError.create('You are not allowed to update this question', 403, status.Fail);
    }

    const { title, body, tags, course } = req.body;
    if (title !== undefined && !String(title).trim()) throw AppError.create('Title cannot be empty', 400, status.Fail);
    if (body !== undefined && !String(body).trim()) throw AppError.create('Body cannot be empty', 400, status.Fail);

    const payload = {};
    if (title !== undefined) payload.title = String(title).trim();
    if (body !== undefined) payload.body = String(body).trim();
    if (tags !== undefined) payload.tags = tags;
    if (course !== undefined) payload.course = course;

    const updated = await questionService.updateQuestion(req.params.id, payload);
    res.status(200).json({ success: true, message: 'Question updated successfully', data: { question: updated } });
});

const deleteQuestion = catchAsync(async (req, res) => {
    const question = await questionService.getQuestionById(req.params.id);
    if (!question) throw AppError.create('Question not found', 404, status.Fail);

    const authorId = question.author._id || question.author;
    if (String(authorId) !== String(req.user._id)) {
        throw AppError.create('You are not allowed to delete this question', 403, status.Fail);
    }

    await questionService.deleteQuestion(req.params.id);
    res.status(200).json({ success: true, message: 'Question deleted successfully' });
});

module.exports = { createQuestion, getQuestions, getSingleQuestion, updateQuestion, deleteQuestion };
