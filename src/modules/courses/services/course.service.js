let httpStatus = require("http-status");
if (httpStatus.default) httpStatus = httpStatus.default;

const Course = require("../models/course.model");
const Section = require("../models/section.model");
require("../models/lesson.model");

const createCourse = async (courseBody) => {
  return Course.create(courseBody);
};

const createSection = async (courseId, sectionBody) => {
  const course = await Course.findById(courseId);
  if (!course) {
    const error = new Error("Course not found");
    error.statusCode = httpStatus.NOT_FOUND;
    throw error;
  }

  sectionBody.courseId = courseId;
  const existingSectionsCount = await Section.countDocuments({ courseId });
  sectionBody.order = existingSectionsCount + 1;

  const section = await Section.create(sectionBody);
  course.sections.push(section._id);
  await course.save();

  return section;
};

const getAllCourses = async (queryParams = {}) => {
  const page = Math.max(Number(queryParams.page) || 1, 1);
  const limit = Math.min(Math.max(Number(queryParams.limit) || 10, 1), 100);
  const skip = (page - 1) * limit;

  const allowedSortFields = ["createdAt", "updatedAt", "title"];
  const sortBy = allowedSortFields.includes(queryParams.sortBy) ? queryParams.sortBy : "createdAt";
  const sortOrder = queryParams.sortOrder === "asc" ? 1 : -1;

  const filter = {};
  if (queryParams.search) {
    filter.title = { $regex: queryParams.search, $options: "i" };
  }
  if (queryParams.instructorId) {
    filter.instructor = queryParams.instructorId;
  }

  const [items, total] = await Promise.all([
    Course.find(filter)
      .sort({ [sortBy]: sortOrder })
      .skip(skip)
      .limit(limit)
      .populate("instructor", "name email")
      .populate("sections"),
    Course.countDocuments(filter),
  ]);

  return {
    items,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
};

const getCourseById = async (courseId) => {
  const course = await Course.findById(courseId).populate("sections").populate("instructor", "name email");
  if (!course) {
    const error = new Error("Course not found");
    error.statusCode = httpStatus.NOT_FOUND;
    throw error;
  }
  return course;
};

const updateCourse = async (courseId, updateBody) => {
  const course = await Course.findByIdAndUpdate(courseId, updateBody, { new: true });
  if (!course) {
    const error = new Error("Course not found");
    error.statusCode = httpStatus.NOT_FOUND;
    throw error;
  }
  return course;
};

const deleteCourse = async (courseId) => {
  const course = await Course.findById(courseId);
  if (!course) {
    const error = new Error("Course not found");
    error.statusCode = httpStatus.NOT_FOUND;
    throw error;
  }

  await Section.deleteMany({ courseId });
  await course.deleteOne();
  return course;
};

const getCoursesByLevel = async (level) => {
  const courses = await Course.find({ level }).populate("instructor", "name email").populate("sections");
  return courses;
}
module.exports = {
  createCourse,
  createSection,
  getAllCourses,
  getCourseById,
  updateCourse,
  deleteCourse,
  getCoursesByLevel
};
