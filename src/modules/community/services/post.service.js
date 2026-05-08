const Post = require("../models/post.model.js");
const Thread = require("../models/thread.model.js");
const AppError = require("../../../core/utils/errorHandler");
const status = require("../../../core/constants/httpStatus");
const { emitPostCreated } = require("../../../realtime/events");

const ALLOWED_CREATE_FIELDS = ["body", "thread", "author"];
const ALLOWED_UPDATE_FIELDS = ["body"];

const normalizePagination = (page, limit) => {
    const p = Math.max(Number(page) || 1, 1);
    const l = Math.min(Math.max(Number(limit) || 20, 1), 100);
    return { page: p, limit: l, skip: (p - 1) * l };
};

const createPost = async (data) => {
    const safeData = Object.fromEntries(
        Object.entries(data).filter(([key]) => ALLOWED_CREATE_FIELDS.includes(key))
    );

    const thread = await Thread.findById(safeData.thread);
    if (!thread) {
        throw AppError.create("Thread not found", 404, status.Fail);
    }

    if (thread.status === "closed") {
        throw AppError.create(
            "This thread is closed. No new posts are allowed.",
            403,
            status.Fail
        );
    }

    const post = await Post.create(safeData);

    await Thread.findByIdAndUpdate(safeData.thread, { $inc: { postsCount: 1 } });

    const populated = await Post.findById(post._id).populate("author", "name avatar role");

    emitPostCreated(String(safeData.thread), populated);

    return populated;
};

const getPostsByThread = async (threadId, { page = 1, limit = 20 } = {}) => {
    const { page: p, limit: l, skip } = normalizePagination(page, limit);

    // Sort: pinned first, then accepted, then votes, then chronological
    const [posts, total] = await Promise.all([
        Post.find({ thread: threadId })
            .populate("author", "name avatar role")
            .sort({ isPinned: -1, isAccepted: -1, votesCount: -1, createdAt: 1 })
            .skip(skip)
            .limit(l),
        Post.countDocuments({ thread: threadId }),
    ]);

    return {
        posts,
        pagination: { page: p, limit: l, total, totalPages: Math.ceil(total / l) || 1 },
    };
};

const getPostById = async (id) => {
    return await Post.findById(id).populate("author", "name avatar role");
};

const updatePost = async (id, data) => {
    const safeData = Object.fromEntries(
        Object.entries(data).filter(([key]) => ALLOWED_UPDATE_FIELDS.includes(key))
    );

    return await Post.findByIdAndUpdate(
        id,
        { ...safeData, updatedAt: Date.now() },
        { returnDocument: "after" }
    ).populate("author", "name avatar role");
};

const deletePost = async (id) => {
    const post = await Post.findByIdAndDelete(id);

    if (post && post.thread) {
        await Thread.findByIdAndUpdate(post.thread, { $inc: { postsCount: -1 } });
    }

    return post;
};

const pinPost = async (postId) => {
    return await Post.findByIdAndUpdate(
        postId,
        { isPinned: true },
        { returnDocument: "after" }
    ).populate("author", "name avatar role");
};

const acceptPost = async (postId, requestingUserId) => {
    const post = await Post.findById(postId);
    if (!post) {
        throw AppError.create("Post not found", 404, status.Fail);
    }

    const thread = await Thread.findById(post.thread).populate("course");
    if (!thread) {
        throw AppError.create("Thread not found", 404, status.Fail);
    }

    const isThreadAuthor = String(thread.author) === String(requestingUserId);
    const isCourseInstructor =
        thread.course &&
        String(thread.course.instructor) === String(requestingUserId);

    if (!isThreadAuthor && !isCourseInstructor) {
        throw AppError.create(
            "Only the thread author or course instructor can accept a post",
            403,
            status.Fail
        );
    }

    await Post.updateMany(
        { thread: post.thread, _id: { $ne: postId } },
        { $set: { isAccepted: false } }
    );

    post.isAccepted = true;
    await post.save();

    return await Post.findById(postId).populate("author", "name avatar role");
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
