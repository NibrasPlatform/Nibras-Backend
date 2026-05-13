const express = require("express");
const progressController = require("../controllers/progress.controller");
const { authenticate } = require("../../../core/middlewares/auth.middleware");

const router = express.Router({ mergeParams: true });

// GET /api/courses/progress/global - Get global progress for authenticated student
router.get("/progress/global", authenticate, progressController.getGlobalProgress);

// GET /api/courses/:courseId/progress - Get student progress for a course
router.get("/:courseId/progress", authenticate, progressController.getStudentProgress);

// POST /api/courses/:courseId/sections/:sectionId/toggle - Toggle section completion
router.post(
  "/:courseId/sections/:sectionId/toggle",
  authenticate,
  progressController.toggleSectionCompletion
);

module.exports = router;
