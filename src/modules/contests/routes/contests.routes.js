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

router.get("/", valid(getContestsValidator), getContests);
router.get("/:id", getContestById);

router.use(authMiddleware.authenticate);

router.post(
  "/sync",
  authorizeRoles("admin"),
  valid(syncContestsValidator),
  syncContests
);

router.post(
  "/update-statuses",
  authorizeRoles("admin"),
  updateStatuses
);

module.exports = router;
