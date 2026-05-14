const router = require("express").Router();
const problemController = require("../controllers/problem.controller");
const authMiddleware = require("../../../core/middlewares/auth.middleware");
const { authorizeRoles } = require("../../../core/middlewares/role.middleware");
const valid = require("../../../core/middlewares/validation.middleware");
const {
  createProblemValidator,
  updateProblemValidator,
  problemIdValidator,
  getProblemsValidator,
} = require("../validation/problem.validator");

router.use(authMiddleware.authenticate);

router.get("/", valid(getProblemsValidator), problemController.getProblems);
router.get("/roadmap", problemController.getRoadmap);
router.get("/progress", problemController.getProgressByDifficulty);

router.post(
  "/",
  authorizeRoles("Admin", "Super Admin"),
  valid(createProblemValidator),
  problemController.createProblem
);

router.patch(
  "/:id",
  authorizeRoles("Admin", "Super Admin"),
  valid(problemIdValidator),
  valid(updateProblemValidator),
  problemController.updateProblem
);

router.delete(
  "/:id",
  authorizeRoles("Admin", "Super Admin"),
  valid(problemIdValidator),
  problemController.deleteProblem
);

router.patch(
  "/:id/solved",
  valid(problemIdValidator),
  problemController.setProblemSolvedStatus
);

module.exports = router;
