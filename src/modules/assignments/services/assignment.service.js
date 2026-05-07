let httpStatus = require("http-status");
if (httpStatus.default) httpStatus = httpStatus.default;

const Assignment = require("../models/assignment.model");
const Course = require("../../courses/models/course.model");
const Section = require("../../courses/models/section.model");

const createAssignment = async (assignmentBody) => {
  const course = await Course.findById(assignmentBody.courseId);
  if (!course) {
    const error = new Error("Course not found");
    error.statusCode = httpStatus.NOT_FOUND;
    throw error;
  }

  const section = await Section.findOne({
    _id: assignmentBody.sectionId,
    courseId: assignmentBody.courseId,
  });
  if (!section) {
    const error = new Error("Section not found or does not belong to this course");
    error.statusCode = httpStatus.BAD_REQUEST;
    throw error;
  }

  assignmentBody.instructor = course.instructor;
  return Assignment.create(assignmentBody);
};

const getAssignmentsByCourse = async (courseId, queryParams = {}) => {
  const page = Math.max(Number(queryParams.page) || 1, 1);
  const limit = Math.min(Math.max(Number(queryParams.limit) || 10, 1), 100);
  const skip = (page - 1) * limit;
  const allowedSortFields = ["createdAt", "updatedAt", "dueDate", "title"];
  const sortBy = allowedSortFields.includes(queryParams.sortBy) ? queryParams.sortBy : "createdAt";
  const sortOrder = queryParams.sortOrder === "asc" ? 1 : -1;

  const filter = { courseId };
  if (queryParams.sectionId) {
    filter.sectionId = queryParams.sectionId;
  }
  if (queryParams.search) {
    filter.title = { $regex: queryParams.search, $options: "i" };
  }

  const [items, total] = await Promise.all([
    Assignment.find(filter)
      .populate("courseId", "title")
      .populate("sectionId", "title order")
      .populate("instructor", "name email")
      .sort({ [sortBy]: sortOrder })
      .skip(skip)
      .limit(limit),
    Assignment.countDocuments(filter),
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

const getAssignmentById = async (assignmentId) => {
  const assignment = await Assignment.findById(assignmentId)
    .populate("courseId", "title instructor")
    .populate("sectionId", "title")
    .populate("instructor", "name email");

  if (!assignment) {
    const error = new Error("Assignment not found");
    error.statusCode = httpStatus.NOT_FOUND;
    throw error;
  }

  return assignment;
};

const getAssignmentOwnerId = (assignment) => {
  if (assignment.instructor) {
    return assignment.instructor._id ? assignment.instructor._id.toString() : assignment.instructor.toString();
  }

  if (assignment.courseId && assignment.courseId.instructor) {
    return assignment.courseId.instructor._id
      ? assignment.courseId.instructor._id.toString()
      : assignment.courseId.instructor.toString();
  }

  return null;
};

const updateAssignment = async (assignmentId, updateBody) => {
  const assignment = await Assignment.findById(assignmentId);
  if (!assignment) {
    const error = new Error("Assignment not found");
    error.statusCode = httpStatus.NOT_FOUND;
    throw error;
  }

  const courseId = updateBody.courseId || assignment.courseId;
  const sectionId = updateBody.sectionId || assignment.sectionId;

  const course = await Course.findById(courseId);
  if (!course) {
    const error = new Error("Course not found");
    error.statusCode = httpStatus.NOT_FOUND;
    throw error;
  }

  const section = await Section.findOne({ _id: sectionId, courseId });
  if (!section) {
    const error = new Error("Section not found or does not belong to this course");
    error.statusCode = httpStatus.BAD_REQUEST;
    throw error;
  }

  updateBody.courseId = courseId;
  updateBody.sectionId = sectionId;
  updateBody.instructor = course.instructor;

  return Assignment.findByIdAndUpdate(assignmentId, updateBody, { new: true })
    .populate("courseId", "title")
    .populate("sectionId", "title")
    .populate("instructor", "name email");
};

const deleteAssignment = async (assignmentId) => {
  const assignment = await Assignment.findById(assignmentId);
  if (!assignment) {
    const error = new Error("Assignment not found");
    error.statusCode = httpStatus.NOT_FOUND;
    throw error;
  }

  await assignment.deleteOne();
  return assignment;
};

module.exports = {
  createAssignment,
  getAssignmentsByCourse,
  getAssignmentById,
  getAssignmentOwnerId,
  updateAssignment,
  deleteAssignment,
};
