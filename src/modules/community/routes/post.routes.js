const express = require("express");
const router = express.Router();
const postController = require("../controllers/post.controller.js");
const authMiddleware = require("../../../core/middlewares/auth.middleware");
const roleMiddleware = require("../../../core/middlewares/role.middleware");
const validate = require("../../../core/middlewares/validation.middleware");
const { createPostValidator, updatePostValidator } = require("../validation/post.validator.js");
const AppError = require("../../../core/utils/errorHandler");
const status = require("../../../core/constants/httpStatus");

// Create a post in a thread
router.post(
    "/:threadId",
    authMiddleware.authenticate,
    validate(createPostValidator),
    postController.createPost
);

// List posts in a thread
router.get("/thread/:threadId", authMiddleware.authenticate, postController.getPostsByThread);

// Get single post
router.get("/:id", authMiddleware.authenticate, postController.getPostById);

// Update post
router.patch(
    "/:id",
    authMiddleware.authenticate,
    validate(updatePostValidator),
    postController.updatePost
);

// Delete post
router.delete("/:id", authMiddleware.authenticate, postController.deletePost);

// Pin post (instructor/admin only)
router.patch(
    "/:id/pin",
    authMiddleware.authenticate,
    roleMiddleware("instructor", "admin"),
    postController.pinPost
);

// Accept post
router.patch("/:id/accept", authMiddleware.authenticate, postController.acceptPost);

router.all("", (req, res, next) => {
    next(AppError.create("Route not found", 404, status.Fail));
});

module.exports = router;
