let httpStatus = require("http-status");
if (httpStatus.default) httpStatus = httpStatus.default;

const Course = require("../models/course.model");
const Section = require("../models/section.model");
const Progress = require("../models/progress.model");

// دالة مساعدة لتجنب مشاكل الـ Regex في البحث
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// توحيد مسميات التابات عشان الـ Frontend
const normalizeCategory = (rawCategory = "") => {
  const value = String(rawCategory).trim().toLowerCase();
  if (!value || value === "all") return null;
  if (value === "core") return "Core";
  if (value === "elective" || value === "electives") return "Elective";
  if (value === "competitive programming") return "Competitive Programming";
  if (value === "general") return "General";
  return null;
};

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
  const order = course.sections.length + 1;
  const section = await Section.create({ ...sectionBody, courseId, order });
  course.sections.push(section._id);
  await course.save();
  return section;
};

/**
 * جلب بيانات الـ Dashboard للطالب
 */
const getMyDashboard = async ({ userId, studentLevel, category } = {}) => {
  const filter = {};
  if (studentLevel) {
    filter.level = { $regex: `^${escapeRegex(String(studentLevel).trim())}$`, $options: "i" };
  }
  if (category) {
    const normalizedCategory = normalizeCategory(category);
    if (normalizedCategory) {
      filter.category = normalizedCategory;
    }
  }

  const courses = await Course.find(filter)
    .sort({ createdAt: -1 })
    .populate("instructor", "name");

  const courseIds = courses.map((c) => c._id);
  const progressDocs = await Progress.find({ userId, courseId: { $in: courseIds } });
  const progressByCourse = new Map(progressDocs.map((p) => [p.courseId.toString(), p]));

  return courses.map((course) => {
    const progress = progressByCourse.get(course._id.toString());
    const hasProgress = Boolean(progress);
    return {
      _id: course._id,
      title: course.title,
      instructorName: course.instructorName || course.instructor?.name || "Nibras Instructor",
      level: course.level,
      category: course.category,
      progressPercentage: hasProgress ? progress.percentage : 0,
      status: hasProgress ? progress.status : "not_started",
      assignmentsCount: Array.isArray(course.assignments) ? course.assignments.length : 0,
      hasStarted: hasProgress,
    };
  });
};

/**
 * جلب الكورسات بناءً على الليفل (الدالة اللي كانت ناقصة)
 */
const getCoursesByLevel = async (level) => {
  const safeLevel = escapeRegex(String(level).trim());
  return Course.find({ level: { $regex: `^${safeLevel}$`, $options: "i" } })
    .populate("instructor", "name")
    .sort({ createdAt: -1 });
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
  if (queryParams.level) filter.level = queryParams.level;
  if (queryParams.instructorId) {
    filter.instructor = queryParams.instructorId;
  }
  if (queryParams.category) {
    const norm = normalizeCategory(queryParams.category);
    if (norm) filter.category = norm;
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

const getCourseById = async (courseId, userId = null) => {
  const course = await Course.findById(courseId)
    .populate({
      path: "sections",
      options: { sort: { order: 1 } }
    })
    .populate("instructor", "name email");

  if (!course) {
    const error = new Error("Course not found");
    error.statusCode = httpStatus.NOT_FOUND;
    throw error;
  }

  if (userId) {
    const progress = await Progress.findOne({ userId, courseId }).lean();
    const sectionsWithStatus = course.sections.map((section) => {
      const progressItem = progress?.items?.find(
        (item) => item.itemId.toString() === section._id.toString()
      );
      return {
        ...section.toObject(),
        status: progressItem ? progressItem.status : "locked"
      };
    });

    return {
      ...course.toObject(),
      sections: sectionsWithStatus,
      overallPercentage: progress ? progress.percentage : 0
    };
  }

  return course;
};

/**
 * التحقق من صلاحية الوصول لليفل (قفل الـ Intermediate)
 */
const checkLevelAccess = async (userId, targetLevel) => {
  if (targetLevel.toLowerCase() === "beginner") return true;

  if (targetLevel.toLowerCase() === "intermediate") {
    const beginnerCourses = await Course.find({ level: "Beginner" }).select("_id");
    if (beginnerCourses.length === 0) return true;

    const beginnerIds = beginnerCourses.map(c => c._id);
    const completedCount = await Progress.countDocuments({
      userId,
      courseId: { $in: beginnerIds },
      status: "completed"
    });

    return completedCount === beginnerIds.length;
  }

  return false;
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
  return Course.find({ level: { $regex: `^${escapeRegex(String(level).trim())}$`, $options: "i" } })
    .populate("instructor", "name email")
    .populate("sections");
};

const getCourseByCode = async (courseCode) => {
  const safeCode = escapeRegex(String(courseCode || "").trim());
  return Course.findOne({ courseCode: { $regex: `^${safeCode}$`, $options: "i" } }).populate("sections");
};

module.exports = {
  createCourse,
  createSection,
  getAllCourses,
  getMyDashboard,
  getCoursesByLevel, 
  getCourseById,
  checkLevelAccess,
  getCourseByCode,
  updateCourse,
  deleteCourse,
  getCoursesByLevel
};
