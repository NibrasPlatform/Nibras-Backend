const tagService = require("../services/tag.service.js");
const AppError = require("../../../core/utils/errorHandler");
const status = require("../../../core/constants/httpStatus");

const getPopularTags = async (req, res, next) => {
    try {
        const limit = parseInt(req.query.limit) || 5;
        const tags = await tagService.getPopularTags(limit);
        res.status(200).json({ message: "Tags fetched successfully", tags });
    } catch (err) {
        next(AppError.create(err.message, 500, status.Error));
    }
};
const getAllTags = async (req, res, next) => {
    try {
        const tags = await tagService.getAllTags();
        res.status(200).json({ message: "Tags fetched successfully", tags });
    } catch (err) {
        next(AppError.create(err.message, 500, status.Error));
    }
}
const getTagById = async (req, res, next) => {
    try {
        const tag = await tagService.getTagById(req.params.id);
        if (!tag) {
            return next(AppError.create("Tag not found", 404, status.Fail));
        }
        res.status(200).json({ message: "Tag fetched successfully", tag });
    } catch (err) {
        next(AppError.create(err.message, 500, status.Error));
    }
};

// const searchTags = async (req, res, next) => {
//     try {
//         const query = req.query.q;
//         if (!query || !query.trim()) {
//             return next(AppError.create("Search query is required", 400, status.Fail));
//         }
//         const limit = parseInt(req.query.limit) || 10;
//         const tags = await tagService.searchTags(query, limit);
//         res.status(200).json({ message: "Tags found", tags });
//     } catch (err) {
//         next(AppError.create(err.message, 500, status.Error));
//     }
// };

// const getTagById = async (req, res, next) => {
//     try {
//         const tag = await tagService.getTagById(req.params.id);
//         if (!tag) {
//             return next(AppError.create("Tag not found", 404, status.Fail));
//         }
//         res.status(200).json({ message: "Tag fetched successfully", tag });
//     } catch (err) {
//         next(AppError.create(err.message, 500, status.Error));
//     }
// };

const createTag = async (req, res, next) => {
    try {
        const { name, description } = req.body;

        if (!name || !String(name).trim()) {
            return next(AppError.create("Tag name cannot be empty", 400, status.Fail));
        }

        const tag = await tagService.createTag({ name, description });
        res.status(201).json({ message: "Tag created successfully", tag });
    } catch (err) {
        next(AppError.create(err.message, err.statusCode || 500, status.Error));
    }
};

const updateTag = async (req, res, next) => {
    try {
        const { name, description } = req.body;

        if (name !== undefined && !String(name).trim()) {
            return next(AppError.create("Tag name cannot be empty", 400, status.Fail));
        }

        const tag = await tagService.updateTag(req.params.id, { name, description });
        res.status(200).json({ message: "Tag updated successfully", tag });
    } catch (err) {
        next(AppError.create(err.message, err.statusCode || 500, status.Error));
    }
};

const deleteTag = async (req, res, next) => {
    try {
        await tagService.deleteTag(req.params.id);
        res.status(200).json({ message: "Tag deleted successfully" });
    } catch (err) {
        next(AppError.create(err.message, err.statusCode || 500, status.Error));
    }
};

module.exports = {
    getPopularTags,
    getAllTags,
    // searchTags,
    getTagById,
    createTag,
    updateTag,
    deleteTag,
};
