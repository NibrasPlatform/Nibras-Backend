const Question = require("../models/question.model.js");
const tagService = require("./tag.service.js");
const { emitQuestionCreated } = require("../../../realtime/events");
const ALLOWED_CREATE_FIELDS = ["title", "body", "tags", "course", "author"];
const ALLOWED_UPDATE_FIELDS = ["title", "body", "tags", "course"];

const createQuestion = async (data) => {
    let tagIds = [];
    if (data.tags && Array.isArray(data.tags) && data.tags.length > 0) {
        for (const tagName of data.tags) {
            try {
                const tagId = await tagService.getTagIdByName(tagName);
                tagIds.push(tagId);
                await tagService.incrementUsageCountByTagId(tagId, 1);
            } catch (err) {
                console.warn(`Tag "${tagName}" not found, skipping`);
            }
        }
    }

    const safeData = Object.fromEntries(
        Object.entries(data).filter(([key]) =>
            ALLOWED_CREATE_FIELDS.includes(key)
        )
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
        .populate("tags");

    const questionObj = populated.toObject();
    questionObj.tags = populated.tags.map(t => t.name);

    emitQuestionCreated(questionObj);

    return questionObj;
};

const getQuestions = async (filters = {}) => {
    const query = {};

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

    const questions = await Question.find(query)
        .populate("author")
        .populate("course")
        .populate("tags")
        .sort(sortOptions);

    return questions.map(q => {
        const obj = q.toObject();
        if (Array.isArray(q.tags)) {
            obj.tags = (q.tags || []).map(t => t.name);
        } else {
            obj.tags = [];
        }
        return obj;
    });
};

const getQuestionById = async (id) => {
    const question = await Question.findById(id)
        .populate("author")
        .populate("course")
        .populate("tags");
    
    if (!question) return null;
    
    const obj = question.toObject();
    obj.tags = question.tags.map(t => t.name);
    return obj;
};

const updateQuestion = async (id, data) => {
    const updateData = Object.fromEntries(
        Object.entries(data).filter(([key]) =>
            ALLOWED_UPDATE_FIELDS.includes(key)
        )
    );

    if (data.tags && Array.isArray(data.tags) && data.tags.length > 0) {
        const oldQuestion = await Question.findById(id);
        const oldTagIds = oldQuestion ? oldQuestion.tags : [];
        
        const newTagIds = [];
        for (const tagName of data.tags) {
            try {
                const tagId = await tagService.getTagIdByName(tagName);
                newTagIds.push(tagId);
            } catch (err) {
                console.warn(`Tag "${tagName}" not found, skipping`);
            }
        }

        const addedTagIds = newTagIds.filter((tagId) => !oldTagIds.includes(tagId));
        const removedTagIds = oldTagIds.filter((tagId) => !newTagIds.includes(tagId));

        for (const tagId of addedTagIds) {
            await tagService.incrementUsageCountByTagId(tagId, 1);
        }
        for (const tagId of removedTagIds) {
            await tagService.incrementUsageCountByTagId(tagId, -1);
        }
    }
    
    updateData.updatedAt = Date.now();
    const updated = await Question.findByIdAndUpdate(id, updateData, {  returnDocument: "after" } )
        .populate("author")
        .populate("course")
        .populate("tags");
    
    if (!updated) return null;
    
    const obj = updated.toObject();
    obj.tags = updated.tags.map(t => t.name);
    return obj;
};

const deleteQuestion = async (id) => {
    const question = await Question.findById(id);
    if (question && question.tags && question.tags.length > 0) {
        for(const tagId of question.tags) {
            await tagService.incrementUsageCountByTagId(tagId, -1);
        }
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
