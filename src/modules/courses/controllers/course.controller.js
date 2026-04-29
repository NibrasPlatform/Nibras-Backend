let httpStatus = require("http-status");
if (httpStatus.default) httpStatus = httpStatus.default;

const catchAsync = require("../../../core/utils/catchAsync");
const courseService = require("../services/course.service");

const createCourse = catchAsync(async (req, res) => {
  const courseData = req.body;
  courseData.instructor = req.user.id || req.user._id;

  const course = await courseService.createCourse(courseData);
  res.status(httpStatus.CREATED).json({
    success: true,
    message: "Course created successfully.",
    data: course,
  });
});

const createSection = catchAsync(async (req, res) => {
  const { courseId } = req.params;
  const section = await courseService.createSection(courseId, req.body);

  res.status(httpStatus.CREATED).json({
    success: true,
    message: "Section created successfully",
    data: section,
  });
});

const getAllCourses = catchAsync(async (req, res) => {
  const result = await courseService.getAllCourses(req.query);
  res.status(httpStatus.OK).json({
    success: true,
    data: result.items,
    meta: result.meta,
  });
});

const getCourseById = catchAsync(async (req, res) => {
  const { courseId } = req.params;
  const course = await courseService.getCourseById(courseId);

  res.status(httpStatus.OK).json({
    success: true,
    data: course,
  });
});

const updateCourse = catchAsync(async (req, res) => {
  const { courseId } = req.params;
  const course = await courseService.getCourseById(courseId);
  const isAdmin = req.user.role.name === "Admin" || req.user.role.name === "Super Admin";
  const courseInstructorId = course.instructor?._id
    ? course.instructor._id.toString()
    : course.instructor.toString();
  const isOwner = req.user.role.name === "Instructor" && courseInstructorId === (req.user.id || req.user._id).toString();

  if (!isAdmin && !isOwner) {
    return res.status(httpStatus.FORBIDDEN).json({
      success: false,
      message: "Access Denied: You can only update your own courses.",
    });
  }

  const updatedCourse = await courseService.updateCourse(courseId, req.body);

  res.status(httpStatus.OK).json({
    success: true,
    message: "Course updated successfully.",
    data: updatedCourse,
  });
});

const deleteCourse = catchAsync(async (req, res) => {
  const { courseId } = req.params;
  const course = await courseService.getCourseById(courseId);
  const isAdmin = req.user.role.name === "Admin" || req.user.role.name === "Super Admin";
  const courseInstructorId = course.instructor?._id
    ? course.instructor._id.toString()
    : course.instructor.toString();
  const isOwner = req.user.role.name === "Instructor" && courseInstructorId === (req.user.id || req.user._id).toString();

  if (!isAdmin && !isOwner) {
    return res.status(httpStatus.FORBIDDEN).json({
      success: false,
      message: "Access Denied: You can only delete your own courses.",
    });
  }

  await courseService.deleteCourse(courseId);

  res.status(httpStatus.OK).json({
    success: true,
    message: "Course and its sections deleted successfully.",
  });
});

module.exports = {
  createCourse,
  createSection,
  getAllCourses,
  getCourseById,
  updateCourse,
  deleteCourse,
};
