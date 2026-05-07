const threadService = require("../services/thread.service.js");
const courseService = require("../services/course.service.js");
const AppError = require("../../../core/utils/errorHandler");
const status = require("../../../core/constants/httpStatus");
const mongoose = require("mongoose");
const getRoleName = (req) => String(req.user?.role?.name || req.user?.role || "").toLowerCase();

const createThread = async (req, res, next) => {
    try {
        const { courseId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(courseId)) {
            return next(AppError.create("Invalid course ID", 400, status.Fail));
        }

        // Enrollment check
        if (!courseService.isEnrolled(req.user, courseId)) {
            return next(
                AppError.create(
                    "You must be enrolled in this course to create a thread",
                    403,
                    status.Fail
                )
            );
        }

        const { title, body, tags } = req.body;

        if (!title || !String(title).trim()) {
            return next(AppError.create("Thread title is required", 400, status.Fail));
        }

        if (!body || !String(body).trim()) {
            return next(AppError.create("Thread body is required", 400, status.Fail));
        }

        const payload = {
            title: String(title).trim(),
            body: String(body).trim(),
            course: courseId,
            author: req.user._id,
            tags: tags || [],
        };

        const thread = await threadService.createThread(payload);
        res.status(201).json({ message: "Thread created successfully", thread });
    } catch (err) {
        next(err);
    }
};

const getThreadsByCourse = async (req, res, next) => {
    try {
        const { courseId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(courseId)) {
            return next(AppError.create("Invalid course ID", 400, status.Fail));
        }

        // Enrollment check
        if (!courseService.isEnrolled(req.user, courseId)) {
            return next(
                AppError.create(
                    "You must be enrolled in this course to view threads",
                    403,
                    status.Fail
                )
            );
        }

        const filters = {
            search: req.query.search,
            status: req.query.status,
            tag: req.query.tag,
        };

        const threads = await threadService.getThreadsByCourse(courseId, filters);
        res.status(200).json({ message: "Threads fetched successfully", threads });
    } catch (err) {
        next(err);
    }
};

const getThreadById = async (req, res, next) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return next(AppError.create("Invalid thread ID", 400, status.Fail));
        }
        const thread = await threadService.getThreadById(req.params.id);
        if (!thread) {
            return next(AppError.create("Thread not found", 404, status.Fail));
        }

        // Enrollment check using the thread's course
        if (!courseService.isEnrolled(req.user, thread.course._id || thread.course)) {
            return next(
                AppError.create(
                    "You must be enrolled in this course to view this thread",
                    403,
                    status.Fail
                )
            );
        }

        res.status(200).json({ message: "Thread fetched successfully", thread });
    } catch (err) {
        next(err);
    }
};

const updateThread = async (req, res, next) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return next(AppError.create("Invalid thread ID", 400, status.Fail));
        }
        const thread = await threadService.getThreadById(req.params.id);
        if (!thread) {
            return next(AppError.create("Thread not found", 404, status.Fail));
        }

        const courseId = thread.course._id || thread.course;

        // Must be enrolled
        if (!courseService.isEnrolled(req.user, courseId)) {
            return next(
                AppError.create(
                    "You must be enrolled in this course to update a thread",
                    403,
                    status.Fail
                )
            );
        }

        // Must be author (or admin)
        const authorId = thread.author._id || thread.author;
        if (getRoleName(req) !== "admin" && getRoleName(req) !== "super admin" && String(authorId) !== String(req.user._id)) {
            return next(
                AppError.create(
                    "You are not allowed to update this thread",
                    403,
                    status.Fail
                )
            );
        }

        const { title, body, tags } = req.body;

        if (title !== undefined && !String(title).trim()) {
            return next(AppError.create("Title cannot be empty", 400, status.Fail));
        }

        if (body !== undefined && !String(body).trim()) {
            return next(AppError.create("Body cannot be empty", 400, status.Fail));
        }

        const payload = {};
        if (title !== undefined) payload.title = String(title).trim();
        if (body !== undefined) payload.body = String(body).trim();
        if (tags !== undefined) payload.tags = tags;

        const updated = await threadService.updateThread(req.params.id, payload);
        res.status(200).json({ message: "Thread updated successfully", thread: updated });
    } catch (err) {
        next(err);
    }
};

const deleteThread = async (req, res, next) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return next(AppError.create("Invalid thread ID", 400, status.Fail));
        }
        const thread = await threadService.getThreadById(req.params.id);
        if (!thread) {
            return next(AppError.create("Thread not found", 404, status.Fail));
        }

        const courseId = thread.course._id || thread.course;
        const authorId = thread.author._id || thread.author;

        // Author, instructor of the course, or admin can delete
        const isAuthor = String(authorId) === String(req.user._id);
        const roleName = getRoleName(req);
        const isAdmin = roleName === "admin" || roleName === "super admin";
        const isInstructor = roleName === "instructor" &&
            courseService.isEnrolled(req.user, courseId);

        if (!isAuthor && !isAdmin && !isInstructor) {
            return next(
                AppError.create(
                    "You are not allowed to delete this thread",
                    403,
                    status.Fail
                )
            );
        }

        await threadService.deleteThread(req.params.id);
        res.status(200).json({ message: "Thread deleted successfully" });
    } catch (err) {
        next(err);
    }
};

const pinThread = async (req, res, next) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return next(AppError.create("Invalid thread ID", 400, status.Fail));
        }
        const thread = await threadService.getThreadById(req.params.id);
        if (!thread) {
            return next(AppError.create("Thread not found", 404, status.Fail));
        }

        const updated = await threadService.pinThread(req.params.id);
        res.status(200).json({ message: "Thread pinned successfully", thread: updated });
    } catch (err) {
        next(err);
    }
};

const unpinThread = async (req, res, next) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return next(AppError.create("Invalid thread ID", 400, status.Fail));
        }
        const thread = await threadService.getThreadById(req.params.id);
        if (!thread) {
            return next(AppError.create("Thread not found", 404, status.Fail));
        }

        const updated = await threadService.unpinThread(req.params.id);
        res.status(200).json({ message: "Thread unpinned successfully", thread: updated });
    } catch (err) {
        next(err);
    }
};

const closeThread = async (req, res, next) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return next(AppError.create("Invalid thread ID", 400, status.Fail));
        }
        const thread = await threadService.getThreadById(req.params.id);
        if (!thread) {
            return next(AppError.create("Thread not found", 404, status.Fail));
        }

        const courseId = thread.course._id || thread.course;
        const authorId = thread.author._id || thread.author;

        // Author, instructor, or admin can close
        const isAuthor = String(authorId) === String(req.user._id);
        const roleName = getRoleName(req);
        const isAdmin = roleName === "admin" || roleName === "super admin";
        const isInstructor = roleName === "instructor" &&
            courseService.isEnrolled(req.user, courseId);

        if (!isAuthor && !isAdmin && !isInstructor) {
            return next(
                AppError.create(
                    "You are not allowed to close this thread",
                    403,
                    status.Fail
                )
            );
        }

        const updated = await threadService.closeThread(req.params.id);
        res.status(200).json({ message: "Thread closed successfully", thread: updated });
    } catch (err) {
        next(err);
    }
};

const openThread = async (req, res, next) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return next(AppError.create("Invalid thread ID", 400, status.Fail));
        }
        const thread = await threadService.getThreadById(req.params.id);
        if (!thread) {
            return next(AppError.create("Thread not found", 404, status.Fail));
        }

        const updated = await threadService.openThread(req.params.id);
        res.status(200).json({ message: "Thread opened successfully", thread: updated });
    } catch (err) {
        next(err);
    }
};

module.exports = {
    createThread,
    getThreadsByCourse,
    getThreadById,
    updateThread,
    deleteThread,
    pinThread,
    unpinThread,
    closeThread,
    openThread,
};
