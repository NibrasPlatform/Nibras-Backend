let httpStatus = require("http-status");
if (httpStatus.default) httpStatus = httpStatus.default;

const catchAsync = require("../../../core/utils/catchAsync");
const courseService = require("../services/course.service");
const User = require("../../users/models/user.model");

/**
 * داتا الـ Dashboard المفلترة بناءً على الـ selectedLevel
 */
const getMyDashboard = catchAsync(async (req, res) => {
  const user = req.user;
  const studentLevel = user?.selectedLevel || "Beginner";

  const courses = await courseService.getMyDashboard({
    userId: user.id || user._id,
    studentLevel,
    category: req.query.category,
  });

  const stats = {
    coursesEnrolled: courses.filter(c => c.hasStarted).length,
    overallProgress: courses.length > 0 
      ? Math.round(courses.reduce((acc, curr) => acc + curr.progressPercentage, 0) / courses.length) 
      : 0
  };

  res.status(httpStatus.OK).json({
    success: true,
    data: { stats, courses, activeLevel: studentLevel },
  });
});

/**
 * تحديث المستوى المختار (تُستدعى من صفحة الـ 4 مربعات)
 */
const updateSelectedLevel = catchAsync(async (req, res) => {
  const { level } = req.body;
  const updatedUser = await User.findByIdAndUpdate(
    req.user.id || req.user._id,
    { selectedLevel: level },
    { new: true }
  );
  res.status(httpStatus.OK).json({
    success: true,
    message: `Level set to ${level} successfully.`,
    data: updatedUser.selectedLevel,
  });
});

/**
 * جلب كورس بالـ ID
 */
const getCourseById = catchAsync(async (req, res) => {
  const { courseId } = req.params;
  const userId = req.user ? (req.user.id || req.user._id) : null;
  const course = await courseService.getCourseById(courseId, userId);
  res.status(httpStatus.OK).json({ success: true, data: course });
});

/**
 * جلب كورس بالـ Code
 */
const getCourseByCode = catchAsync(async (req, res) => {
  const { code } = req.params;
  const course = await courseService.getCourseByCode(code);
  res.status(httpStatus.OK).json({ success: true, data: course });
});

/**
 * جلب الكورسات بناءً على الليفل
 */
const getCoursesByLevel = catchAsync(async (req, res) => {
  const { level } = req.params;
  const courses = await courseService.getCoursesByLevel(level);
  res.status(httpStatus.OK).json({ success: true, data: courses });
});

/**
 * جلب كل الكورسات (Admin)
 */
const getAllCourses = catchAsync(async (req, res) => {
  const result = await courseService.getAllCourses(req.query);
  res.status(httpStatus.OK).json({ success: true, data: result.items, meta: result.meta });
});

/**
 * إنشاء كورس
 */
const createCourse = catchAsync(async (req, res) => {
  const courseData = req.body;
  courseData.instructor = req.user.id || req.user._id;
  const course = await courseService.createCourse(courseData);
  res.status(httpStatus.CREATED).json({ success: true, data: course });
});

/**
 * إنشاء سكشن
 */
const createSection = catchAsync(async (req, res) => {
  const { courseId } = req.params;
  const section = await courseService.createSection(courseId, req.body);
  res.status(httpStatus.CREATED).json({ success: true, data: section });
});

/**
 * تحديث كورس
 */
const updateCourse = catchAsync(async (req, res) => {
  const updated = await courseService.updateCourse(req.params.courseId, req.body);
  res.status(httpStatus.OK).json({ success: true, data: updated });
});

/**
 * حذف كورس
 */
const deleteCourse = catchAsync(async (req, res) => {
  await courseService.deleteCourse(req.params.courseId);
  res.status(httpStatus.OK).json({ success: true, message: "Deleted successfully" });
});

module.exports = {
  getMyDashboard,
  updateSelectedLevel,
  getCourseById,
  getCourseByCode,
  getCoursesByLevel,
  getAllCourses,
  createCourse,
  createSection,
  updateCourse,
  deleteCourse,
};