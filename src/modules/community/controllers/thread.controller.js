const catchAsync = require("../../../core/utils/catchAsync");
const AppError = require("../../../core/utils/errorHandler");
const threadService = require("../services/thread.service.js");
const courseService = require("../services/course.service.js");
const mongoose = require("mongoose");

const getRoleName = (req) => String(req.user?.role?.name || req.user?.role || "").toLowerCase();

const createThread = catchAsync(async (req, res) => {
    const { courseId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(courseId)) {
        throw AppError.create("Invalid course ID", 400, "fail");
    }

    if (!courseService.isEnrolled(req.user, courseId)) {
        throw AppError.create("You must be enrolled in this course to create a thread", 403, "fail");
    }

    const { title, body, tags } = req.body;

    if (!title || !String(title).trim()) {
        throw AppError.create("Thread title is required", 400, "fail");
    }
    if (!body || !String(body).trim()) {
        throw AppError.create("Thread body is required", 400, "fail");
    }

    const payload = {
        title: String(title).trim(),
        body: String(body).trim(),
        course: courseId,
        author: req.user._id,
        tags: tags || [],
    };

    const thread = await threadService.createThread(payload);
    res.status(201).json({ success: true, message: "Thread created successfully", data: { thread } });
});

const getThreadsByCourse = catchAsync(async (req, res) => {
    const { courseId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(courseId)) {
        throw AppError.create("Invalid course ID", 400, "fail");
    }

    if (!courseService.isEnrolled(req.user, courseId)) {
        throw AppError.create("You must be enrolled in this course to view threads", 403, "fail");
    }

    const filters = {
        search: req.query.search,
        status: req.query.status,
        tag: req.query.tag,
        page: req.query.page,
        limit: req.query.limit,
    };

    const { threads, pagination } = await threadService.getThreadsByCourse(courseId, filters);
    res.status(200).json({ success: true, message: "Threads fetched successfully", data: { threads, pagination } });
});

const getThreadById = catchAsync(async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        throw AppError.create("Invalid thread ID", 400, "fail");
    }
    const thread = await threadService.getThreadById(req.params.id);
    if (!thread) throw AppError.create("Thread not found", 404, "fail");

    if (!courseService.isEnrolled(req.user, thread.course._id || thread.course)) {
        throw AppError.create("You must be enrolled in this course to view this thread", 403, "fail");
    }

    res.status(200).json({ success: true, message: "Thread fetched successfully", data: { thread } });
});

const updateThread = catchAsync(async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        throw AppError.create("Invalid thread ID", 400, "fail");
    }
    const thread = await threadService.getThreadById(req.params.id);
    if (!thread) throw AppError.create("Thread not found", 404, "fail");

    const courseId = thread.course._id || thread.course;
    if (!courseService.isEnrolled(req.user, courseId)) {
        throw AppError.create("You must be enrolled in this course to update a thread", 403, "fail");
    }

    const authorId = thread.author._id || thread.author;
    const roleName = getRoleName(req);
    if (roleName !== "admin" && roleName !== "super admin" && String(authorId) !== String(req.user._id)) {
        throw AppError.create("You are not allowed to update this thread", 403, "fail");
    }

    const { title, body, tags } = req.body;
    if (title !== undefined && !String(title).trim()) throw AppError.create("Title cannot be empty", 400, "fail");
    if (body !== undefined && !String(body).trim()) throw AppError.create("Body cannot be empty", 400, "fail");

    const payload = {};
    if (title !== undefined) payload.title = String(title).trim();
    if (body !== undefined) payload.body = String(body).trim();
    if (tags !== undefined) payload.tags = tags;

    const updated = await threadService.updateThread(req.params.id, payload);
    res.status(200).json({ success: true, message: "Thread updated successfully", data: { thread: updated } });
});

const deleteThread = catchAsync(async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        throw AppError.create("Invalid thread ID", 400, "fail");
    }
    const thread = await threadService.getThreadById(req.params.id);
    if (!thread) throw AppError.create("Thread not found", 404, "fail");

    const courseId = thread.course._id || thread.course;
    const authorId = thread.author._id || thread.author;
    const isAuthor = String(authorId) === String(req.user._id);
    const roleName = getRoleName(req);
    const isAdmin = roleName === "admin" || roleName === "super admin";
    const isInstructor = roleName === "instructor" && courseService.isEnrolled(req.user, courseId);

    if (!isAuthor && !isAdmin && !isInstructor) {
        throw AppError.create("You are not allowed to delete this thread", 403, "fail");
    }

    await threadService.deleteThread(req.params.id);
    res.status(200).json({ success: true, message: "Thread deleted successfully" });
});

const pinThread = catchAsync(async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        throw AppError.create("Invalid thread ID", 400, "fail");
    }
    const thread = await threadService.getThreadById(req.params.id);
    if (!thread) throw AppError.create("Thread not found", 404, "fail");

    const updated = await threadService.pinThread(req.params.id);
    res.status(200).json({ success: true, message: "Thread pinned successfully", data: { thread: updated } });
});

const unpinThread = catchAsync(async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        throw AppError.create("Invalid thread ID", 400, "fail");
    }
    const thread = await threadService.getThreadById(req.params.id);
    if (!thread) throw AppError.create("Thread not found", 404, "fail");

    const updated = await threadService.unpinThread(req.params.id);
    res.status(200).json({ success: true, message: "Thread unpinned successfully", data: { thread: updated } });
});

const closeThread = catchAsync(async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        throw AppError.create("Invalid thread ID", 400, "fail");
    }
    const thread = await threadService.getThreadById(req.params.id);
    if (!thread) throw AppError.create("Thread not found", 404, "fail");

    const courseId = thread.course._id || thread.course;
    const authorId = thread.author._id || thread.author;
    const isAuthor = String(authorId) === String(req.user._id);
    const roleName = getRoleName(req);
    const isAdmin = roleName === "admin" || roleName === "super admin";
    const isInstructor = roleName === "instructor" && courseService.isEnrolled(req.user, courseId);

    if (!isAuthor && !isAdmin && !isInstructor) {
        throw AppError.create("You are not allowed to close this thread", 403, "fail");
    }

    const updated = await threadService.closeThread(req.params.id);
    res.status(200).json({ success: true, message: "Thread closed successfully", data: { thread: updated } });
});

const openThread = catchAsync(async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        throw AppError.create("Invalid thread ID", 400, "fail");
    }
    const thread = await threadService.getThreadById(req.params.id);
    if (!thread) throw AppError.create("Thread not found", 404, "fail");

    const updated = await threadService.openThread(req.params.id);
    res.status(200).json({ success: true, message: "Thread opened successfully", data: { thread: updated } });
});

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
