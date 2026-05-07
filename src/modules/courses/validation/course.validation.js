const Joi = require("joi");

const objectId = Joi.string().hex().length(24);

const listQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  sortBy: Joi.string().valid("createdAt", "updatedAt", "title").default("createdAt"),
  sortOrder: Joi.string().valid("asc", "desc").default("desc"),
  search: Joi.string().trim().allow("").optional(),
  instructorId: objectId.optional(),
  level: Joi.string().valid("Beginner", "Intermediate", "Advanced").optional(),
  category: Joi.string().trim().optional(),
});

const createCourseSchema = Joi.object({
  courseCode: Joi.string().trim().min(3).max(50).required(),
  title: Joi.string().trim().min(3).max(120).required(),
  instructorName: Joi.string().trim().max(120).allow("").optional(),
  description: Joi.string().trim().max(1000).allow("").optional(),
  level: Joi.string().valid("Beginner", "Intermediate", "Advanced").required(),
  category: Joi.string().valid("Core", "Elective", "Competitive Programming", "General").optional(),
  stats: Joi.object({
    duration: Joi.string().trim().max(50).allow("").optional(),
    hoursPerWeek: Joi.number().min(0).optional(),
    enrolledStudents: Joi.number().integer().min(0).optional(),
    term: Joi.string().trim().max(50).allow("").optional(),
  }).optional(),
});

const updateCourseSchema = Joi.object({
  courseCode: Joi.string().trim().min(3).max(50).optional(),
  title: Joi.string().trim().min(3).max(120).optional(),
  instructorName: Joi.string().trim().max(120).allow("").optional(),
  description: Joi.string().trim().max(1000).allow("").optional(),
  level: Joi.string().valid("Beginner", "Intermediate", "Advanced").optional(),
  category: Joi.string().valid("Core", "Elective", "Competitive Programming", "General").optional(),
  stats: Joi.object({
    duration: Joi.string().trim().max(50).allow("").optional(),
    hoursPerWeek: Joi.number().min(0).optional(),
    enrolledStudents: Joi.number().integer().min(0).optional(),
    term: Joi.string().trim().max(50).allow("").optional(),
  }).optional(),
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
