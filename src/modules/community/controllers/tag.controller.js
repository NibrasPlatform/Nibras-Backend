const catchAsync = require("../../../core/utils/catchAsync");
const AppError = require("../../../core/utils/errorHandler");
const tagService = require("../services/tag.service.js");

const getPopularTags = catchAsync(async (req, res) => {
    const limit = parseInt(req.query.limit) || 5;
    const tags = await tagService.getPopularTags(limit);
    res.status(200).json({ success: true, message: "Tags fetched successfully", data: { tags } });
});

const getAllTags = catchAsync(async (req, res) => {
    const { tags, pagination } = await tagService.getAllTags({
        page: req.query.page,
        limit: req.query.limit,
    });
    res.status(200).json({ success: true, message: "Tags fetched successfully", data: { tags, pagination } });
});

const getTagById = catchAsync(async (req, res) => {
    const tag = await tagService.getTagById(req.params.id);
    if (!tag) throw AppError.create("Tag not found", 404, "fail");
    res.status(200).json({ success: true, message: "Tag fetched successfully", data: { tag } });
});

const createTag = catchAsync(async (req, res) => {
    const { name, description } = req.body;

    if (!name || !String(name).trim()) {
        throw AppError.create("Tag name cannot be empty", 400, "fail");
    }

    const tag = await tagService.createTag({ name, description });
    res.status(201).json({ success: true, message: "Tag created successfully", data: { tag } });
});

const updateTag = catchAsync(async (req, res) => {
    const { name, description } = req.body;

    if (name !== undefined && !String(name).trim()) {
        throw AppError.create("Tag name cannot be empty", 400, "fail");
    }

    const tag = await tagService.updateTag(req.params.id, { name, description });
    res.status(200).json({ success: true, message: "Tag updated successfully", data: { tag } });
});

const deleteTag = catchAsync(async (req, res) => {
    await tagService.deleteTag(req.params.id);
    res.status(200).json({ success: true, message: "Tag deleted successfully" });
});

module.exports = {
    getPopularTags,
    getAllTags,
    getTagById,
    createTag,
    updateTag,
    deleteTag,
};
