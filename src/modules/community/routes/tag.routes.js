const express = require("express");
const router = express.Router();
const tagController = require("../controllers/tag.controller.js");
const authMiddleware = require("../../../core/middlewares/auth.middleware");
const {authorizeRoles} = require("../../../core/middlewares/role.middleware");
const status = require("../../../core/constants/httpStatus");
const AppError = require("../../../core/utils/errorHandler");

router.get("/", tagController.getAllTags);
router.get("/popular", tagController.getPopularTags);
router.get("/:id", tagController.getTagById);
router.post("/", authMiddleware.authenticate, authorizeRoles("admin"), tagController.createTag);
router.patch("/:id", authMiddleware.authenticate, authorizeRoles("admin"), tagController.updateTag);
router.delete("/:id", authMiddleware.authenticate, authorizeRoles("admin"), tagController.deleteTag);

router.all('', (req, res, next) => {
    next(AppError.create('Route not found', 404, status.Fail));
});

module.exports = router;
