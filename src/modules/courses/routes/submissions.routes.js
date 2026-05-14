const express = require("express");
const submissionController = require("../controllers/submission.controller");
const { authenticate } = require("../../../core/middlewares/auth.middleware");
const { authorize, authorizeRoles } = require("../../../core/middlewares/role.middleware");

const router = express.Router();

// Student submits or updates assignment submission
router.post("/", authenticate, submissionController.submitAssignment);

// Admin/Instructor reviews submission and can approve it
router.patch(
  "/:submissionId/status",
  authenticate,
  authorizeRoles("Super Admin", "Admin", "Instructor"),
  authorize("manage_assignments"),
  submissionController.updateSubmissionStatus
);

module.exports = router;
