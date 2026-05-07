const Tag = require("../models/tag.model.js");
const AppError = require("../../../core/utils/errorHandler");
const status = require("../../../core/constants/httpStatus");

const getTagIdByName = async (tagName) => {
    const tag = await Tag.findOne({ name: { $regex: new RegExp(`^${tagName}$`, 'i') } });
    if (!tag) {
        throw AppError.create(`Tag "${tagName}" not found`, 404, status.Fail);
    }
    return tag._id;
};

const getTagByName = async (tagName) => {
    return await Tag.findOne({ name: { $regex: new RegExp(`^${tagName}$`, 'i') } });
};

const getPopularTags = async (limit = 20) => {
    return await Tag.find()
        .sort({ usageCount: -1 })
        .limit(limit);
};

const getAllTags = async () => {
    return await Tag.find()
        .sort({ name: 1 });
};

const searchTags = async (query, limit = 10) => {
    if (!query || !query.trim()) {
        return getPopularTags(limit);
    }
    
    const regex = new RegExp(query, 'i');
    return await Tag.find({ name: { $regex: regex } })
        .sort({ usageCount: -1 })
        .limit(limit);
};

const getTagById = async (id) => {
    return await Tag.findById(id);
};

const createTag = async (data) => {
    const existing = await Tag.findOne({ name: data.name });
    if (existing) {
        throw AppError.create("Tag already exists", 400, status.Fail);
    }

    const tag = new Tag({
        name: String(data.name).trim(),
        description: data.description || "",
        usageCount: 0,
    });
    return await tag.save();
};

const updateTag = async (id, data) => {
    const tag = await Tag.findById(id);
    if (!tag) {
        throw AppError.create("Tag not found", 404, status.Fail);
    }

    if (data.name) {
        const existing = await Tag.findOne({
            name: data.name,
            _id: { $ne: id },
        });
        if (existing) {
            throw AppError.create("Tag name already exists", 400, status.Fail);
        }
        tag.name = String(data.name).trim();
    }

    if (data.description !== undefined) {
        tag.description = data.description;
    }

    return await tag.save();
};

const deleteTag = async (id) => {
    const tag = await Tag.findByIdAndDelete(id);
    if (!tag) {
        throw AppError.create("Tag not found", 404, status.Fail);
    }
    return tag;
};

const incrementUsageCountByTagId = async (tagId, delta = 1) => {
    if (!tagId) return;
    await Tag.findByIdAndUpdate(tagId, { $inc: { usageCount: delta } });
};

const incrementUsageCount = async (tagIds, delta = 1) => {
    if (!tagIds || !Array.isArray(tagIds) || tagIds.length === 0) return;
    await Tag.updateMany({ _id: { $in: tagIds } }, { $inc: { usageCount: delta } });
};

module.exports = {
    getTagIdByName,
    getTagByName,
    getPopularTags,
    getAllTags,
    searchTags,
    getTagById,
    createTag,
    updateTag,
    deleteTag,
    incrementUsageCountByTagId,
    incrementUsageCount,
};