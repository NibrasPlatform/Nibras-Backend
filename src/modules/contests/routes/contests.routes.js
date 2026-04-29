const router = require("express").Router();
const {
  getContests,
  getContestById,
  syncContests,
  updateStatuses,
} = require("../controllers/contest.controller");
const authMiddleware = require("../../../core/middlewares/auth.middleware");
const roleMiddleware = require("../../../core/middlewares/role.middleware");
const {
  getContestsValidator,
  syncContestsValidator,
} = require("../validation/contest.validator");
const valid = require("../../../core/middlewares/validation.middleware");

router.get("/", getContestsValidator, valid, getContests);
router.get("/:id", getContestById);

router.use(authMiddleware.authenticate);

router.post(
  "/sync",
  roleMiddleware("admin"),
  syncContestsValidator,
  valid,
  syncContests
);

router.post(
  "/update-statuses",
  roleMiddleware("admin"),
  updateStatuses
);

module.exports = router;
