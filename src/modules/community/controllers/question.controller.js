const questionService = require('../services/question.service.js');
const answerService = require('../services/answer.service.js');
const AppError = require("../../../core/utils/errorHandler");
const status = require("../../../core/constants/httpStatus");

const createQuestion = async (req, res, next) => {
    try {
        const { title, body, tags, course } = req.body;

        if (title !== undefined && !String(title).trim()) {
            return next(AppError.create('Title cannot be empty', 400, status.Fail));
        }

        if (body !== undefined && !String(body).trim()) {
            return next(AppError.create('Body cannot be empty', 400, status.Fail));
        }

        if (!title || !body) {
            return next(AppError.create('Title and body are required', 400, status.Fail));
        }

        const payload = {
            title: String(title).trim(),
            body: String(body).trim(),
            tags: tags || [],
            course: course,
        };

        if (req.user && req.user._id) {
            payload.author = req.user._id;
        }

        const question = await questionService.createQuestion(payload);
        res.status(201).json({ message: 'Question created successfully', question });
    } catch (err) {
        next(err);
    }
};

const getQuestions = async (req, res, next) => {
    try {
        const filters = {
            search: req.query.search,
            title: req.query.title,
            tag: req.query.tag,
            course: req.query.course,
        };
        const questions = await questionService.getQuestions(filters);
        res
            .status(200)
            .json({ message: 'Questions fetched successfully', questions });

    } catch (err) {
        next(err);
    }
};

const getSingleQuestion = async (req, res, next) => {
    try {
        const question = await questionService.getQuestionById(req.params.id);
        if (!question) {
            return next(AppError.create('Question not found', 404, status.Fail));
        }

        const answers = await answerService.getAnswersForQuestion(req.params.id);

        res.status(200).json({
            message: 'Question fetched successfully',
            question,
            answers,
        });
    } catch (err) {
        next(err);
    }
};

const updateQuestion = async (req, res, next) => {
    try {
        const question = await questionService.getQuestionById(req.params.id);
        if (!question) {
            return next(AppError.create('Question not found', 404, status.Fail));
        }

        const authorId = question.author._id || question.author;
        if (!req.user || String(authorId) !== String(req.user._id)) {
            return next(
                AppError.create(
                    'You are not allowed to update this question',
                    403,
                    status.Fail
                )
            );
        }

        const { title, body, tags, course } = req.body;

        if (title !== undefined && !String(title).trim()) {
            return next(AppError.create('Title cannot be empty', 400, status.Fail));
        }

        if (body !== undefined && !String(body).trim()) {
            return next(AppError.create('Body cannot be empty', 400, status.Fail));
        }

        const payload = {};
        if (title !== undefined) payload.title = String(title).trim();
        if (body !== undefined) payload.body = String(body).trim();
        if (tags !== undefined) payload.tags = tags;
        if (course !== undefined) payload.course = course;

        const updated = await questionService.updateQuestion(req.params.id, payload);

        res
            .status(200)
            .json({ message: 'Question updated successfully', question: updated });
    } catch (err) {
        next(err);
    }
};

const deleteQuestion = async (req, res, next) => {
    try {
        // if (!req.user || req.user.role !== 'admin') {
        //     return next(
        //         AppError.create(
        //             'Only admin can delete questions',
        //             403,
        //             status.Fail
        //         )
        //     );
        // }
        const question = await questionService.getQuestionById(req.params.id);
        if (!question) {
            return next(AppError.create('Question not found', 404, status.Fail));
        }
            const authorId = question.author._id || question.author;
        if (!req.user || String(authorId) !== String(req.user._id)) {
            return next(
                AppError.create(
                    'You are not allowed to delete this question',
                    403,
                    status.Fail
                )
            );
        }
        await questionService.deleteQuestion(req.params.id);
        res.status(200).json({ message: 'Question deleted successfully' });
    } catch (err) {
        next(err);
    }
};

module.exports = {
    createQuestion,
    getQuestions,
    getSingleQuestion,
    updateQuestion,
    deleteQuestion,
};
