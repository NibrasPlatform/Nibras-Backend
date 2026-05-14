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
const createCourse = catchAsync(async (req, res) => {
  const courseData = req.body;
  courseData.instructor = req.user._id;

  const stats = {
    coursesEnrolled: courses.filter(c => c.hasStarted).length,
    overallProgress: courses.length > 0 
      ? Math.round(courses.reduce((acc, curr) => acc + curr.progressPercentage, 0) / courses.length) 
      : 0
  };

  res.status(httpStatus.OK).json({
    success: true,
    data: { stats, courses },
  });
});

/**
 * تفاصيل الكورس الواحد مع حالة السكاشن
 */
const getCourseById = catchAsync(async (req, res) => {
  const { courseId } = req.params;
  const userId = req.user ? (req.user.id || req.user._id) : null;
  
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

/**
 * جلب كل الكورسات (Admin)
 */
const getAllCourses = catchAsync(async (req, res) => {
  const result = await courseService.getAllCourses(req.query);
const updateCourse = catchAsync(async (req, res) => {
  const { courseId } = req.params;
  const course = await courseService.getCourseById(courseId);
  const isAdmin = req.user.role.name === "Admin" || req.user.role.name === "Super Admin";
  const courseInstructorId = course.instructor?._id
    ? course.instructor._id.toString()
    : course.instructor.toString();
  const isOwner = req.user.role.name === "Instructor" && courseInstructorId === (req.user._id).toString();

  if (!isAdmin && !isOwner) {
    return res.status(httpStatus.FORBIDDEN).json({
      success: false,
      message: "Access Denied: You can only update your own courses.",
    });
  }

  const updatedCourse = await courseService.updateCourse(courseId, req.body);

  res.status(httpStatus.OK).json({
    success: true,
    data: result.items,
    meta: result.meta,
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
  const course = await courseService.getCourseById(courseId);
  const isAdmin = req.user.role.name === "Admin" || req.user.role.name === "Super Admin";
  const courseInstructorId = course.instructor?._id
    ? course.instructor._id.toString()
    : course.instructor.toString();
  const isOwner = req.user.role.name === "Instructor" && courseInstructorId === (req.user._id).toString();

  if (!isAdmin && !isOwner) {
    return res.status(httpStatus.FORBIDDEN).json({
      success: false,
      message: "Access Denied: You can only delete your own courses.",
    });
  }

const updateCourse = catchAsync(async (req, res) => {
  const updated = await courseService.updateCourse(req.params.courseId, req.body);
  res.status(httpStatus.OK).json({ success: true, data: updated });
});

const deleteCourse = catchAsync(async (req, res) => {
  await courseService.deleteCourse(req.params.courseId);
  res.status(httpStatus.OK).json({ success: true, message: "Deleted successfully" });
});

// تأكد إن كل الدوال دي مكتوبة هنا في الـ Exports
const getCoursesByLevel = catchAsync(async (req, res) => {
  const { level } = req.params;
  const courses = await courseService.getCoursesByLevel(level);

  res.status(httpStatus.OK).json({
    success: true,
    data: courses,
  });
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
  getCoursesByLevel
};
