const Thread = require("../models/thread.model.js");
const Post = require("../models/post.model.js");
const Tag = require("../models/tag.model.js");
const tagService = require("./tag.service.js");
const AppError = require("../../../core/utils/errorHandler");
const status = require("../../../core/constants/httpStatus");
const { emitThreadCreated } = require("../../../realtime/events");
const activityEventService = require("../../gamification/services/activityEvent.service");

const ALLOWED_CREATE_FIELDS = ["title", "body", "course", "author", "tags"];
const ALLOWED_UPDATE_FIELDS = ["title", "body", "tags"];

const normalizePagination = (page, limit) => {
    const p = Math.max(Number(page) || 1, 1);
    const l = Math.min(Math.max(Number(limit) || 20, 1), 100);
    return { page: p, limit: l, skip: (p - 1) * l };
};

const createThread = async (data) => {
    let tagIds = [];
    if (data.tags && Array.isArray(data.tags) && data.tags.length > 0) {
        for (const tagName of data.tags) {
            try {
                const tagId = await tagService.getTagIdByName(tagName);
                tagIds.push(tagId);
            } catch (err) {
                console.warn(`[thread.service] Tag "${tagName}" not found, skipping`);
            }
        }
        // Bulk increment in one query
        if (tagIds.length) await Tag.updateMany({ _id: { $in: tagIds } }, { $inc: { usageCount: 1 } });
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
        .populate("tags")
        .lean();

    const threadObj = { ...populated, tags: (populated.tags || []).map((t) => t.name) };

    emitThreadCreated(threadObj);
    await activityEventService.recordThreadCreated({
        userId: populated.author?._id || populated.author,
        threadId: populated._id,
        courseId: populated.course?._id || populated.course || null,
        occurredAt: populated.createdAt,
        roleSnapshot: populated.author?.role?.name || null,
    });

    return threadObj;
};

const getThreadsByCourse = async (courseId, filters = {}) => {
    const query = { course: courseId };
    const { page, limit, skip } = normalizePagination(filters.page, filters.limit);

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

    const [threads, total] = await Promise.all([
        Thread.find(query)
            .populate("author", "name avatar role")
            .populate("tags")
            .sort({ isPinned: -1, createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean(),
        Thread.countDocuments(query),
    ]);

    const data = threads.map((t) => ({
        ...t,
        tags: (t.tags || []).map((tag) => tag.name),
    }));

    return {
        threads: data,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    };
};

const getThreadById = async (id) => {
    const thread = await Thread.findById(id)
        .populate("author", "name avatar role")
        .populate("course", "title")
        .populate("tags")
        .lean();

    if (!thread) return null;

    return { ...thread, tags: (thread.tags || []).map((t) => t.name) };
};

const updateThread = async (id, data) => {
    const updateData = Object.fromEntries(
        Object.entries(data).filter(([key]) => ALLOWED_UPDATE_FIELDS.includes(key))
    );

    if (data.tags && Array.isArray(data.tags)) {
        const oldThread = await Thread.findById(id).lean();
        const oldTagIds = oldThread ? oldThread.tags.map(String) : [];

        const newTagIds = [];
        for (const tagName of data.tags) {
            try {
                const tagId = await tagService.getTagIdByName(tagName);
                newTagIds.push(tagId);
            } catch (err) {
                console.warn(`[thread.service] Tag "${tagName}" not found, skipping`);
            }
        }

        const addedTagIds = newTagIds.filter((id) => !oldTagIds.includes(String(id)));
        const removedTagIds = oldTagIds.filter((old) => !newTagIds.some((n) => String(n) === old));

        if (addedTagIds.length) await Tag.updateMany({ _id: { $in: addedTagIds } }, { $inc: { usageCount: 1 } });
        if (removedTagIds.length) await Tag.updateMany({ _id: { $in: removedTagIds } }, { $inc: { usageCount: -1 } });

        updateData.tags = newTagIds;
    }

    updateData.updatedAt = Date.now();

    const updated = await Thread.findByIdAndUpdate(id, updateData, { returnDocument: "after" })
        .populate("author", "name avatar role")
        .populate("course", "title")
        .populate("tags")
        .lean();

    if (!updated) return null;

    return { ...updated, tags: (updated.tags || []).map((t) => t.name) };
};

const deleteThread = async (id) => {
    const thread = await Thread.findById(id).lean();
    if (!thread) return null;

    // Bulk decrement tag usage counts in one query
    if (thread.tags && thread.tags.length > 0) {
        await Tag.updateMany({ _id: { $in: thread.tags } }, { $inc: { usageCount: -1 } });
    }

    await Post.deleteMany({ thread: id });

    return await Thread.findByIdAndDelete(id);
};

const pinThread = async (id) => {
    return await Thread.findByIdAndUpdate(id, { isPinned: true }, { returnDocument: "after" });
};

const unpinThread = async (id) => {
    return await Thread.findByIdAndUpdate(id, { isPinned: false }, { returnDocument: "after" });
};

const closeThread = async (id) => {
    return await Thread.findByIdAndUpdate(id, { status: "closed" }, { returnDocument: "after" });
};

const openThread = async (id) => {
    return await Thread.findByIdAndUpdate(id, { status: "open" }, { returnDocument: "after" });
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
