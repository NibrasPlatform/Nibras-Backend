const Joi = require("joi");

const objectId = Joi.string().hex().length(24);

const listQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  sortBy: Joi.string().valid("createdAt", "updatedAt", "title").default("createdAt"),
  sortOrder: Joi.string().valid("asc", "desc").default("desc"),
  search: Joi.string().trim().allow("").optional(),
  instructorId: objectId.optional(),
});

const createCourseSchema = Joi.object({
  title: Joi.string().trim().min(3).max(120).required(),
  description: Joi.string().trim().max(1000).allow("").optional(),
});

const updateCourseSchema = Joi.object({
  title: Joi.string().trim().min(3).max(120).optional(),
  description: Joi.string().trim().max(1000).allow("").optional(),
  instructor: objectId.optional(),
}).min(1);

const createSectionSchema = Joi.object({
  title: Joi.string().trim().min(2).max(180).required(),
});

module.exports = {
  listQuerySchema,
  createCourseSchema,
  updateCourseSchema,
  createSectionSchema,
};
