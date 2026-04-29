const express = require("express");
const router = express.Router();
const threadController = require("../controllers/thread.controller.js");
const authMiddleware = require("../../../core/middlewares/auth.middleware");
const roleMiddleware = require("../../../core/middlewares/role.middleware");
const validate = require("../../../core/middlewares/validation.middleware");
const { createThreadValidator, updateThreadValidator } = require("../validation/thread.validator.js");
const AppError = require("../../../core/utils/errorHandler");
const status = require("../../../core/constants/httpStatus");

// Create thread in a course
router.post(
    "/:courseId",
    authMiddleware.authenticate,
    createThreadValidator,
    validate,
    threadController.createThread
);

// List threads in a course
router.get(
    "/course/:courseId",
    authMiddleware.authenticate,
    threadController.getThreadsByCourse
);

// Get single thread
router.get("/:id", authMiddleware.authenticate, threadController.getThreadById);

// Update thread
router.patch(
    "/:id",
    authMiddleware.authenticate,
    updateThreadValidator,
    validate,
    threadController.updateThread
);

// Delete thread
router.delete("/:id", authMiddleware.authenticate, threadController.deleteThread);

// Pin / unpin thread (instructor/admin only)
router.patch(
    "/:id/pin",
    authMiddleware.authenticate,
    roleMiddleware("instructor", "admin"),
    threadController.pinThread
);
router.patch(
    "/:id/unpin",
    authMiddleware.authenticate,
    roleMiddleware("instructor", "admin"),
    threadController.unpinThread
);

// Close / open thread
router.patch("/:id/close", authMiddleware.authenticate, threadController.closeThread);
router.patch(
    "/:id/open",
    authMiddleware.authenticate,
    roleMiddleware("instructor", "admin"),
    threadController.openThread
);

router.all("", (req, res, next) => {
    next(AppError.create("Route not found", 404, status.Fail));
});

module.exports = router;
