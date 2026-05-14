const express = require("express");
const mongoose = require("mongoose");
const { authenticate } = require("../../../core/middlewares/auth.middleware");
const roleMiddleware = require("../../../core/middlewares/role.middleware");
const mentorshipController = require("../controllers/mentorship.controller");
const AppError = require("../../../core/utils/errorHandler");

const router = express.Router();

const validateUserId = (req, res, next) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.userId)) {
    return next(AppError.create("userId must be a valid ObjectId", 400, "fail"));
  }
  next();
};

router.use(authenticate);

router.get("/suggestions/me", mentorshipController.getMySuggestions);
router.put("/profile/me", mentorshipController.updateMyProfile);

router.get(
  "/admin/profiles",
  roleMiddleware.authorizeRoles("Admin", "Super Admin"),
  mentorshipController.listProfiles,
);
router.patch(
  "/admin/profiles/:userId/approve",
  roleMiddleware.authorizeRoles("Admin", "Super Admin"),
  validateUserId,
  mentorshipController.approveProfile,
);
router.patch(
  "/admin/profiles/:userId/reject",
  roleMiddleware.authorizeRoles("Admin", "Super Admin"),
  validateUserId,
  mentorshipController.rejectProfile,
);
router.patch(
  "/admin/profiles/:userId/availability",
  roleMiddleware.authorizeRoles("Admin", "Super Admin"),
  validateUserId,
  mentorshipController.updateAvailability,
);

module.exports = router;
