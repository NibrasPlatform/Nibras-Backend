const express = require("express");
const courseController = require("../controllers/course.controller");
const progressRoutes = require("./progress.routes");
const submissionsRoutes = require("./submissions.routes");
const { authenticate } = require("../../../core/middlewares/auth.middleware");
const { authorize, authorizeRoles } = require("../../../core/middlewares/role.middleware");
const validate = require("../../../core/middlewares/validation.middleware");
const {
  listQuerySchema,
  createCourseSchema,
  updateCourseSchema,
  createSectionSchema,
} = require("../validation/course.validation");

const router = express.Router();

router.use("/", progressRoutes);
router.use("/submissions", submissionsRoutes);

// --- مسارات التحكم (Admin/Instructor) ---
router.post(
  "/",
  authenticate,
  authorizeRoles("Super Admin", "Admin", "Instructor"),
  authorize("manage_courses"),
  validate(createCourseSchema),
  courseController.createCourse
);

router.post(
  "/:courseId/sections",
  authenticate,
  authorizeRoles("Super Admin", "Admin", "Instructor"),
  authorize("manage_courses"),
  validate(createSectionSchema),
  courseController.createSection
);

// --- مسارات الطالب والداشبورد ---
router.get("/", authenticate, validate(listQuerySchema, "query"), courseController.getAllCourses);

// التعديل هنا: الـ Dashboard والـ Level Update
router.get("/my-dashboard", authenticate, courseController.getMyDashboard);
router.patch("/update-level", authenticate, courseController.updateSelectedLevel);

router.get('/level/:level', authenticate, courseController.getCoursesByLevel);
router.get('/code/:code', authenticate, courseController.getCourseByCode);
router.get("/:courseId", authenticate, courseController.getCourseById);

router.patch(
  "/:courseId",
  authenticate,
  authorizeRoles("Super Admin", "Admin", "Instructor"),
  authorize("manage_courses"),
  validate(updateCourseSchema),
  courseController.updateCourse
);

router.delete(
  "/:courseId",
  authenticate,
  authorizeRoles("Super Admin", "Admin", "Instructor"),
  authorize("manage_courses"),
  courseController.deleteCourse
);

module.exports = router;