const router = require("express").Router();
const {
  getContests,
  getContestById,
  syncContests,
  updateStatuses,
} = require("../controllers/contest.controller");
const authMiddleware = require("../../../core/middlewares/auth.middleware");
const { authorize, authorizeRoles } = require("../../../core/middlewares/role.middleware");

const {
  getContestsValidator,
  syncContestsValidator,
} = require("../validation/contest.validator");
const valid = require("../../../core/middlewares/validation.middleware");
const notificationController = require("../../notifications/controllers/notification.controller");

router.get("/", valid(getContestsValidator), getContests);
router.get("/:id", getContestById);

router.use(authMiddleware.authenticate);
router.post("/:contestId/remind", notificationController.scheduleContestReminder);

router.post(
  "/sync",
  authorizeRoles("Admin", "Super Admin"),
  valid(syncContestsValidator),
  syncContests
);

router.post(
  "/update-statuses",
  authorizeRoles("Admin", "Super Admin"),
  updateStatuses
);

module.exports = router;
