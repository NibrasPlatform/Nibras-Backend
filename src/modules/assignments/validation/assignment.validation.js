const Joi = require("joi");

const objectId = Joi.string().hex().length(24);

const listQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  sortBy: Joi.string().valid("createdAt", "updatedAt", "title", "dueDate").default("createdAt"),
  sortOrder: Joi.string().valid("asc", "desc").default("desc"),
  search: Joi.string().trim().allow("").optional(),
  sectionId: objectId.optional(),
});

const createAssignmentSchema = Joi.object({
  title: Joi.string().trim().min(2).max(150).required(),
  description: Joi.string().trim().max(1500).allow("").optional(),
  courseId: objectId.required(),
  sectionId: objectId.required(),
  dueDate: Joi.date().iso().required(),
  maxScore: Joi.number().min(1).max(1000).default(100),
});

const updateAssignmentSchema = Joi.object({
  title: Joi.string().trim().min(2).max(150).optional(),
  description: Joi.string().trim().max(1500).allow("").optional(),
  courseId: objectId.optional(),
  sectionId: objectId.optional(),
  dueDate: Joi.date().iso().optional(),
  maxScore: Joi.number().min(1).max(1000).optional(),
}).min(1);

module.exports = {
  listQuerySchema,
  createAssignmentSchema,
  updateAssignmentSchema,
};
