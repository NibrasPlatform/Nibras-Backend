let httpStatus = require("http-status");
if (httpStatus.default) httpStatus = httpStatus.default;

const Course = require("../models/course.model");
const Section = require("../models/section.model");
const Progress = require("../models/progress.model");
require("../models/lesson.model");

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

/**
 * إنشاء كورس جديد
 */
const createCourse = async (courseBody) => {
  return Course.create(courseBody);
};

/**
 * إضافة سكشن للكورس مع الترتيب التلقائي
 */
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
 * جلب كورس واحد مع حالة السكاشن (Locked/Available/Completed)
 */
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

/**
 * بقية دوال الـ CRUD الأساسية
 */
const getAllCourses = async (queryParams = {}) => {
  const filter = {};
  if (queryParams.level) filter.level = queryParams.level;
  if (queryParams.category) {
      const norm = normalizeCategory(queryParams.category);
      if (norm) filter.category = norm;
  }
  const items = await Course.find(filter).populate("instructor", "name").populate("sections");
  return { items, total: items.length };
};

const getCourseByCode = async (courseCode) => {
  const safeCode = escapeRegex(String(courseCode || "").trim());
  return Course.findOne({ courseCode: { $regex: `^${safeCode}$`, $options: "i" } }).populate("sections");
};

const updateCourse = async (courseId, updateBody) => {
  return Course.findByIdAndUpdate(courseId, updateBody, { new: true });
};

const deleteCourse = async (courseId) => {
  await Section.deleteMany({ courseId });
  return Course.findByIdAndDelete(courseId);
};

module.exports = {
  createCourse,
  createSection,
  getAllCourses,
  getMyDashboard,
  getCourseById,
  checkLevelAccess,
  getCourseByCode,
  updateCourse,
  deleteCourse,
};