const catchAsync = require("../../../core/utils/catchAsync");
const AppError = require("../../../core/utils/errorHandler");
const postService = require("../services/post.service.js");
const threadService = require("../services/thread.service.js");
const courseService = require("../services/course.service.js");
const mongoose = require("mongoose");

const getRoleName = (req) => String(req.user?.role?.name || req.user?.role || "").toLowerCase();

const createPost = catchAsync(async (req, res) => {
    const { threadId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(threadId)) {
        throw AppError.create("Invalid thread ID", 400, "fail");
    }

    const thread = await threadService.getThreadById(threadId);
    if (!thread) throw AppError.create("Thread not found", 404, "fail");

    const courseId = thread.course._id || thread.course;
    if (!courseService.isEnrolled(req.user, courseId)) {
        throw AppError.create("You must be enrolled in this course to post a reply", 403, "fail");
    }

    const { body } = req.body;
    if (!body || !String(body).trim()) {
        throw AppError.create("Post body is required", 400, "fail");
    }

    const payload = {
        body: String(body).trim(),
        thread: threadId,
        author: req.user._id,
    };

    const post = await postService.createPost(payload);
    res.status(201).json({ success: true, message: "Post created successfully", data: { post } });
});

const getPostsByThread = catchAsync(async (req, res) => {
    const { threadId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(threadId)) {
        throw AppError.create("Invalid thread ID", 400, "fail");
    }

    const { posts, pagination } = await postService.getPostsByThread(threadId, {
        page: req.query.page,
        limit: req.query.limit,
    });
    res.status(200).json({ success: true, message: "Posts fetched successfully", data: { posts, pagination } });
});

const getPostById = catchAsync(async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        throw AppError.create("Invalid post ID", 400, "fail");
    }
    const post = await postService.getPostById(req.params.id);
    if (!post) throw AppError.create("Post not found", 404, "fail");
    res.status(200).json({ success: true, message: "Post fetched successfully", data: { post } });
});

const updatePost = catchAsync(async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        throw AppError.create("Invalid post ID", 400, "fail");
    }
    const post = await postService.getPostById(req.params.id);
    if (!post) throw AppError.create("Post not found", 404, "fail");

    const authorId = post.author._id || post.author;
    if (String(authorId) !== String(req.user._id)) {
        throw AppError.create("You are not allowed to update this post", 403, "fail");
    }

    const { body } = req.body;
    if (body !== undefined && !String(body).trim()) {
        throw AppError.create("Post body cannot be empty", 400, "fail");
    }

    const payload = {};
    if (body !== undefined) payload.body = String(body).trim();

    const updated = await postService.updatePost(req.params.id, payload);
    res.status(200).json({ success: true, message: "Post updated successfully", data: { post: updated } });
});

const deletePost = catchAsync(async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        throw AppError.create("Invalid post ID", 400, "fail");
    }
    const post = await postService.getPostById(req.params.id);
    if (!post) throw AppError.create("Post not found", 404, "fail");

    const authorId = post.author._id || post.author;
    const isAuthor = String(authorId) === String(req.user._id);
    const roleName = getRoleName(req);
    const isAdminOrInstructor = roleName === "admin" || roleName === "super admin" || roleName === "instructor";

    if (!isAuthor && !isAdminOrInstructor) {
        throw AppError.create("You are not allowed to delete this post", 403, "fail");
    }

    await postService.deletePost(req.params.id);
    res.status(200).json({ success: true, message: "Post deleted successfully" });
});

const pinPost = catchAsync(async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        throw AppError.create("Invalid post ID", 400, "fail");
    }
    const post = await postService.getPostById(req.params.id);
    if (!post) throw AppError.create("Post not found", 404, "fail");

    const updated = await postService.pinPost(req.params.id);
    res.status(200).json({ success: true, message: "Post pinned successfully", data: { post: updated } });
});

const acceptPost = catchAsync(async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        throw AppError.create("Invalid post ID", 400, "fail");
    }

    const post = await postService.acceptPost(req.params.id, req.user._id);
    res.status(200).json({ success: true, message: "Post accepted successfully", data: { post } });
});

module.exports = {
    createPost,
    getPostsByThread,
    getPostById,
    updatePost,
    deletePost,
    pinPost,
    acceptPost,
};
