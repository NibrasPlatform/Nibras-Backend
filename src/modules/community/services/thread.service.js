const Thread = require("../models/thread.model.js");
const Post = require("../models/post.model.js");
const tagService = require("./tag.service.js");
const AppError = require("../../../core/utils/errorHandler");
const status = require("../../../core/constants/httpStatus");
const { emitThreadCreated } = require("../../../realtime/events");

const ALLOWED_CREATE_FIELDS = ["title", "body", "course", "author", "tags"];
const ALLOWED_UPDATE_FIELDS = ["title", "body", "tags"];

const createThread = async (data) => {
    // Resolve tag names to ObjectIds
    let tagIds = [];
    if (data.tags && Array.isArray(data.tags) && data.tags.length > 0) {
        for (const tagName of data.tags) {
            try {
                const tagId = await tagService.getTagIdByName(tagName);
                tagIds.push(tagId);
                await tagService.incrementUsageCountByTagId(tagId, 1);
            } catch (err) {
                console.warn(`[thread.service] Tag "${tagName}" not found, skipping`);
            }
        }
    }

    const safeData = Object.fromEntries(
        Object.entries(data).filter(([key]) => ALLOWED_CREATE_FIELDS.includes(key))
    );

    const thread = await Thread.create({
        title: safeData.title,
        body: safeData.body,
        course: safeData.course,
        author: safeData.author,
        tags: tagIds,
    });

    const populated = await Thread.findById(thread._id)
        .populate("author", "name avatar role")
        .populate("course", "title")
        .populate("tags");

    const threadObj = populated.toObject();
    threadObj.tags = populated.tags.map((t) => t.name);

    emitThreadCreated(threadObj);

    return threadObj;
};

const getThreadsByCourse = async (courseId, filters = {}) => {
    const query = { course: courseId };

    if (filters.search) {
        query.$text = { $search: filters.search };
    }

    if (filters.status) {
        query.status = filters.status;
    }

    if (filters.tag) {
        const tag = await tagService.getTagByName(filters.tag);
        if (tag) {
            query.tags = tag._id;
        } else {
            query.tags = { $size: 0 };
        }
    }

    const threads = await Thread.find(query)
        .populate("author", "name avatar role")
        .populate("tags")
        .sort({ isPinned: -1, createdAt: -1 });

    return threads.map((t) => {
        const obj = t.toObject();
        obj.tags = (t.tags || []).map((tag) => tag.name);
        return obj;
    });
};

const getThreadById = async (id) => {
    const thread = await Thread.findById(id)
        .populate("author", "name avatar role")
        .populate("course", "title")
        .populate("tags");

    if (!thread) return null;

    const obj = thread.toObject();
    obj.tags = thread.tags.map((t) => t.name);
    return obj;
};

const updateThread = async (id, data) => {
    const updateData = Object.fromEntries(
        Object.entries(data).filter(([key]) => ALLOWED_UPDATE_FIELDS.includes(key))
    );

    if (data.tags && Array.isArray(data.tags)) {
        const oldThread = await Thread.findById(id);
        const oldTagIds = oldThread ? oldThread.tags : [];

        const newTagIds = [];
        for (const tagName of data.tags) {
            try {
                const tagId = await tagService.getTagIdByName(tagName);
                newTagIds.push(tagId);
            } catch (err) {
                console.warn(`[thread.service] Tag "${tagName}" not found, skipping`);
            }
        }

        const addedTagIds = newTagIds.filter(
            (tagId) => !oldTagIds.some((old) => String(old) === String(tagId))
        );
        const removedTagIds = oldTagIds.filter(
            (old) => !newTagIds.some((n) => String(n) === String(old))
        );

        for (const tagId of addedTagIds) {
            await tagService.incrementUsageCountByTagId(tagId, 1);
        }
        for (const tagId of removedTagIds) {
            await tagService.incrementUsageCountByTagId(tagId, -1);
        }

        updateData.tags = newTagIds;
    }

    updateData.updatedAt = Date.now();

    const updated = await Thread.findByIdAndUpdate(id, updateData, {
        returnDocument: "after",
    })
        .populate("author", "name avatar role")
        .populate("course", "title")
        .populate("tags");

    if (!updated) return null;

    const obj = updated.toObject();
    obj.tags = updated.tags.map((t) => t.name);
    return obj;
};

const deleteThread = async (id) => {
    const thread = await Thread.findById(id);
    if (!thread) return null;

    // Decrement tag usage counts
    if (thread.tags && thread.tags.length > 0) {
        for (const tagId of thread.tags) {
            await tagService.incrementUsageCountByTagId(tagId, -1);
        }
    }

    // Cascade delete all posts in this thread
    await Post.deleteMany({ thread: id });

    return await Thread.findByIdAndDelete(id);
};

const pinThread = async (id) => {
    return await Thread.findByIdAndUpdate(
        id,
        { isPinned: true },
        { returnDocument: "after" }
    );
};

const unpinThread = async (id) => {
    return await Thread.findByIdAndUpdate(
        id,
        { isPinned: false },
        { returnDocument: "after" }
    );
};

const closeThread = async (id) => {
    return await Thread.findByIdAndUpdate(
        id,
        { status: "closed" },
        { returnDocument: "after" }
    );
};

const openThread = async (id) => {
    return await Thread.findByIdAndUpdate(
        id,
        { status: "open" },
        { returnDocument: "after" }
    );
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
