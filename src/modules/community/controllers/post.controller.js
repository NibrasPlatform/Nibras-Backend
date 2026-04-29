const postService = require("../services/post.service.js");
const threadService = require("../services/thread.service.js");
const courseService = require("../services/course.service.js");
const AppError = require("../../../core/utils/errorHandler");
const status = require("../../../core/constants/httpStatus");
const mongoose = require("mongoose");

const createPost = async (req, res, next) => {
    try {
        const { threadId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(threadId)) {
            return next(AppError.create("Invalid thread ID", 400, status.Fail));
        }

        // Enforce enrollment: fetch thread → get course → check user is enrolled
        const thread = await threadService.getThreadById(threadId);
        if (!thread) {
            return next(AppError.create("Thread not found", 404, status.Fail));
        }

        const courseId = thread.course._id || thread.course;
        if (!courseService.isEnrolled(req.user, courseId)) {
            return next(
                AppError.create(
                    "You must be enrolled in this course to post a reply",
                    403,
                    status.Fail
                )
            );
        }

        const { body } = req.body;

        if (!body || !String(body).trim()) {
            return next(AppError.create("Post body is required", 400, status.Fail));
        }

        const payload = {
            body: String(body).trim(),
            thread: threadId,
            author: req.user._id,
        };

        const post = await postService.createPost(payload);
        res.status(201).json({ message: "Post created successfully", post });
    } catch (err) {
        next(err);
    }
};

const getPostsByThread = async (req, res, next) => {
    try {
        const { threadId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(threadId)) {
            return next(AppError.create("Invalid thread ID", 400, status.Fail));
        }

        const posts = await postService.getPostsByThread(threadId);
        res.status(200).json({ message: "Posts fetched successfully", posts });
    } catch (err) {
        next(err);
    }
};

const getPostById = async (req, res, next) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return next(AppError.create("Invalid post ID", 400, status.Fail));
        }
        const post = await postService.getPostById(req.params.id);
        if (!post) {
            return next(AppError.create("Post not found", 404, status.Fail));
        }
        res.status(200).json({ message: "Post fetched successfully", post });
    } catch (err) {
        next(err);
    }
};

const updatePost = async (req, res, next) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return next(AppError.create("Invalid post ID", 400, status.Fail));
        }
        const post = await postService.getPostById(req.params.id);
        if (!post) {
            return next(AppError.create("Post not found", 404, status.Fail));
        }

        const authorId = post.author._id || post.author;
        if (!req.user || String(authorId) !== String(req.user._id)) {
            return next(
                AppError.create(
                    "You are not allowed to update this post",
                    403,
                    status.Fail
                )
            );
        }

        const { body } = req.body;

        if (body !== undefined && !String(body).trim()) {
            return next(AppError.create("Post body cannot be empty", 400, status.Fail));
        }

        const payload = {};
        if (body !== undefined) payload.body = String(body).trim();

        const updated = await postService.updatePost(req.params.id, payload);
        res.status(200).json({ message: "Post updated successfully", post: updated });
    } catch (err) {
        next(err);
    }
};

const deletePost = async (req, res, next) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return next(AppError.create("Invalid post ID", 400, status.Fail));
        }
        const post = await postService.getPostById(req.params.id);
        if (!post) {
            return next(AppError.create("Post not found", 404, status.Fail));
        }

        const authorId = post.author._id || post.author;
        const isAuthor = String(authorId) === String(req.user._id);
        const roleName = String(req.user?.role?.name || req.user?.role || "").toLowerCase();
        const isAdminOrInstructor = roleName === "admin" || roleName === "super admin" || roleName === "instructor";

        if (!isAuthor && !isAdminOrInstructor) {
            return next(
                AppError.create(
                    "You are not allowed to delete this post",
                    403,
                    status.Fail
                )
            );
        }

        await postService.deletePost(req.params.id);
        res.status(200).json({ message: "Post deleted successfully" });
    } catch (err) {
        next(err);
    }
};

const pinPost = async (req, res, next) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return next(AppError.create("Invalid post ID", 400, status.Fail));
        }
        const post = await postService.getPostById(req.params.id);
        if (!post) {
            return next(AppError.create("Post not found", 404, status.Fail));
        }

        const updated = await postService.pinPost(req.params.id);
        res.status(200).json({ message: "Post pinned successfully", post: updated });
    } catch (err) {
        next(err);
    }
};

const acceptPost = async (req, res, next) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return next(AppError.create("Invalid post ID", 400, status.Fail));
        }

        const post = await postService.acceptPost(req.params.id, req.user._id);
        res.status(200).json({ message: "Post accepted successfully", post });
    } catch (err) {
        next(err);
    }
};

module.exports = {
    createPost,
    getPostsByThread,
    getPostById,
    updatePost,
    deletePost,
    pinPost,
    acceptPost,
};
