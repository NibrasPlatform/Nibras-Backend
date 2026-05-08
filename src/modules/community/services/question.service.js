const Question = require("../models/question.model.js");
const Tag = require("../models/tag.model.js");
const tagService = require("./tag.service.js");
const { emitQuestionCreated } = require("../../../realtime/events");
const activityEventService = require("../../gamification/services/activityEvent.service");

const ALLOWED_CREATE_FIELDS = ["title", "body", "tags", "course", "author"];
const ALLOWED_UPDATE_FIELDS = ["title", "body", "tags", "course"];

const normalizePagination = (page, limit) => {
    const p = Math.max(Number(page) || 1, 1);
    const l = Math.min(Math.max(Number(limit) || 20, 1), 100);
    return { page: p, limit: l, skip: (p - 1) * l };
};

const createQuestion = async (data) => {
    let tagIds = [];
    if (data.tags && Array.isArray(data.tags) && data.tags.length > 0) {
        for (const tagName of data.tags) {
            try {
                const tagId = await tagService.getTagIdByName(tagName);
                tagIds.push(tagId);
            } catch (err) {
                console.warn(`Tag "${tagName}" not found, skipping`);
            }
        }
        // Bulk increment in one query instead of per-tag loops
        await Tag.updateMany({ _id: { $in: tagIds } }, { $inc: { usageCount: 1 } });
    }

    const safeData = Object.fromEntries(
        Object.entries(data).filter(([key]) => ALLOWED_CREATE_FIELDS.includes(key))
    );

    const question = new Question({
        author: safeData.author,
        course: safeData.course,
        title: safeData.title,
        body: safeData.body,
        tags: tagIds,
    });
    const saved = await question.save();

    const populated = await Question.findById(saved._id)
        .populate("author")
        .populate("tags")
        .lean();

    const questionObj = { ...populated };
    questionObj.tags = (populated.tags || []).map(t => t.name);

    emitQuestionCreated(questionObj);
    await activityEventService.recordQuestionCreated({
        userId: populated.author?._id || populated.author,
        questionId: populated._id,
        courseId: populated.course?._id || populated.course || null,
        occurredAt: populated.createdAt,
        roleSnapshot: populated.author?.role?.name || null,
    });

    return questionObj;
};

const getQuestions = async (filters = {}) => {
    const query = {};
    const { page, limit, skip } = normalizePagination(filters.page, filters.limit);

    if (filters.search) {
        query.$text = { $search: filters.search };
    }

    if (filters.title) {
        query.title = { $regex: filters.title, $options: "i" };
    }

    if (filters.tag) {
        const tag = await tagService.getTagByName(filters.tag);
        if (tag) {
            query.tags = tag._id;
        } else {
            query.tags = { $size: 0 };
        }
    }

    if (filters.course) {
        query.course = filters.course;
    }

    const sortOptions = { createdAt: -1 };
    if (filters.search) {
        sortOptions.score = { $meta: "textScore" };
    }

    const [questions, total] = await Promise.all([
        Question.find(query)
            .populate("author")
            .populate("course")
            .populate("tags")
            .sort(sortOptions)
            .skip(skip)
            .limit(limit)
            .lean(),
        Question.countDocuments(query),
    ]);

    const data = questions.map(q => ({
        ...q,
        tags: Array.isArray(q.tags) ? q.tags.map(t => t.name) : [],
    }));

    return {
        questions: data,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    };
};

const getQuestionById = async (id) => {
    const question = await Question.findById(id)
        .populate("author")
        .populate("course")
        .populate("tags")
        .lean();

    if (!question) return null;

    return { ...question, tags: (question.tags || []).map(t => t.name) };
};

const updateQuestion = async (id, data) => {
    const updateData = Object.fromEntries(
        Object.entries(data).filter(([key]) => ALLOWED_UPDATE_FIELDS.includes(key))
    );

    if (data.tags && Array.isArray(data.tags)) {
        const oldQuestion = await Question.findById(id).lean();
        const oldTagIds = oldQuestion ? oldQuestion.tags.map(String) : [];

        const newTagIds = [];
        for (const tagName of data.tags) {
            try {
                const tagId = await tagService.getTagIdByName(tagName);
                newTagIds.push(tagId);
            } catch (err) {
                console.warn(`Tag "${tagName}" not found, skipping`);
            }
        }

        const addedTagIds = newTagIds.filter((tagId) => !oldTagIds.includes(String(tagId)));
        const removedTagIds = oldTagIds.filter((old) => !newTagIds.some((n) => String(n) === old));

        if (addedTagIds.length) await Tag.updateMany({ _id: { $in: addedTagIds } }, { $inc: { usageCount: 1 } });
        if (removedTagIds.length) await Tag.updateMany({ _id: { $in: removedTagIds } }, { $inc: { usageCount: -1 } });

        updateData.tags = newTagIds;
    }

    updateData.updatedAt = Date.now();
    const updated = await Question.findByIdAndUpdate(id, updateData, { returnDocument: "after" })
        .populate("author")
        .populate("course")
        .populate("tags")
        .lean();

    if (!updated) return null;
    return { ...updated, tags: (updated.tags || []).map(t => t.name) };
};

const deleteQuestion = async (id) => {
    const question = await Question.findById(id).lean();
    if (question && question.tags && question.tags.length > 0) {
        await Tag.updateMany({ _id: { $in: question.tags } }, { $inc: { usageCount: -1 } });
    }
    return await Question.findByIdAndDelete(id);
};

module.exports = {
    createQuestion,
    getQuestions,
    getQuestionById,
    updateQuestion,
    deleteQuestion,
};
