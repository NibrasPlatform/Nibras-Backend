const router = require("express").Router();
const problemController = require("../controllers/problem.controller");
const authMiddleware = require("../../../core/middlewares/auth.middleware");
const roleMiddleware = require("../../../core/middlewares/role.middleware");
const valid = require("../../../core/middlewares/validation.middleware");
const {
  createProblemValidator,
  updateProblemValidator,
  problemIdValidator,
  getProblemsValidator,
} = require("../validation/problem.validator");

router.use(authMiddleware.authenticate);

router.get("/", getProblemsValidator, valid, problemController.getProblems);
router.get("/roadmap", problemController.getRoadmap);
router.get("/progress", problemController.getProgressByDifficulty);

router.post(
  "/",
  roleMiddleware("admin"),
  createProblemValidator,
  valid,
  problemController.createProblem
);

router.patch(
  "/:id",
  roleMiddleware("admin"),
  problemIdValidator,
  updateProblemValidator,
  valid,
  problemController.updateProblem
);

router.delete(
  "/:id",
  roleMiddleware("admin"),
  problemIdValidator,
  valid,
  problemController.deleteProblem
);

router.patch(
  "/:id/solved",
  problemIdValidator,
  valid,
  problemController.setProblemSolvedStatus
);

module.exports = router;
