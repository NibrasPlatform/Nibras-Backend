let httpStatus = require("http-status");
if (httpStatus.default) httpStatus = httpStatus.default;

const catchAsync = require("../../../core/utils/catchAsync");
const courseService = require("../services/course.service");

/**
 * داتا الـ Dashboard شاملة الإحصائيات والكورسات
 */
const getMyDashboard = catchAsync(async (req, res) => {
  const user = req.user;
  const studentLevel = user?.level || user?.currentLevel || user?.learningLevel || "Beginner";

  const courses = await courseService.getMyDashboard({
    userId: user.id || user._id,
    studentLevel,
    category: req.query.category,
  });

  const stats = {
    coursesEnrolled: courses.filter((c) => c.hasStarted).length,
    overallProgress:
      courses.length > 0
        ? Math.round(
            courses.reduce((acc, curr) => acc + curr.progressPercentage, 0) /
              courses.length
          )
        : 0,
  };

  res.status(httpStatus.OK).json({
    success: true,
    data: { stats, courses },
  });
});

const createCourse = catchAsync(async (req, res) => {
  const courseData = req.body;
  courseData.instructor = req.user.id || req.user._id;
  const course = await courseService.createCourse(courseData);
  res.status(httpStatus.CREATED).json({ success: true, data: course });
});

const createSection = catchAsync(async (req, res) => {
  const { courseId } = req.params;
  const section = await courseService.createSection(courseId, req.body);
  res.status(httpStatus.CREATED).json({ success: true, data: section });
});

/**
 * تفاصيل الكورس الواحد مع حالة السكاشن
 */
const getCourseById = catchAsync(async (req, res) => {
  const { courseId } = req.params;
  const userId = req.user ? req.user.id || req.user._id : null;

  const course = await courseService.getCourseById(courseId, userId);

  // تشيك قفل الليفل
  const hasAccess = await courseService.checkLevelAccess(userId, course.level);
  if (!hasAccess) {
    return res.status(httpStatus.FORBIDDEN).json({
      success: false,
      message: `Access Denied: Please complete all Beginner courses to unlock the ${course.level} level.`,
    });
  }

  res.status(httpStatus.OK).json({
    success: true,
    data: course,
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

/**
 * جلب الكورسات بناءً على الليفل
 */
const getCoursesByLevel = catchAsync(async (req, res) => {
  const { level } = req.params;
  const courses = await courseService.getCoursesByLevel(level);
  res.status(httpStatus.OK).json({
    success: true,
    data: courses,
  });
});

/**
 * جلب كورس عن طريق الكود (Code)
 */
const getCourseByCode = catchAsync(async (req, res) => {
  const { code } = req.params;
  const course = await courseService.getCourseByCode(code);
  res.status(httpStatus.OK).json({
    success: true,
    data: course,
  });
});

const updateCourse = catchAsync(async (req, res) => {
  const updated = await courseService.updateCourse(req.params.courseId, req.body);
  res.status(httpStatus.OK).json({ success: true, data: updated });
});

const deleteCourse = catchAsync(async (req, res) => {
  await courseService.deleteCourse(req.params.courseId);
  res.status(httpStatus.OK).json({ success: true, message: "Deleted successfully" });
});

module.exports = {
  createCourse,
  createSection,
  getAllCourses,
  getMyDashboard,
  getCoursesByLevel,
  getCourseByCode,
  getCourseById,
  updateCourse,
  deleteCourse,
};
