const express = require("express");
const assignmentController = require("../controllers/assignment.controller");
const { authenticate } = require("../../../core/middlewares/auth.middleware");
const { authorize, authorizeRoles } = require("../../../core/middlewares/role.middleware");
const validate = require("../../../core/middlewares/validation.middleware");
const {
  listQuerySchema,
  createAssignmentSchema,
  updateAssignmentSchema,
} = require("../validation/assignment.validation");

const router = express.Router();

router.post(
  "/",
  authenticate,
  authorizeRoles("Super Admin", "Admin", "Instructor"),
  authorize("manage_assignments"),
  validate(createAssignmentSchema),
  assignmentController.createAssignment
);
router.get(
  "/course/:courseId",
  authenticate,
  validate(listQuerySchema, "query"),
  assignmentController.getCourseAssignments
);
router.get("/:assignmentId", authenticate, assignmentController.getAssignmentById);
router.patch(
  "/:assignmentId",
  authenticate,
  authorizeRoles("Super Admin", "Admin", "Instructor"),
  authorize("manage_assignments"),
  validate(updateAssignmentSchema),
  assignmentController.updateAssignment
);
router.delete(
  "/:assignmentId",
  authenticate,
  authorizeRoles("Super Admin", "Admin", "Instructor"),
  authorize("manage_assignments"),
  assignmentController.deleteAssignment
);

module.exports = router;
