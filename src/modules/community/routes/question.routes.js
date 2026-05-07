const express = require("express");
const router = express.Router();
const questionController = require("../controllers/question.controller.js");
const authMiddleware = require("../../../core/middlewares/auth.middleware");
const AppError = require("../../../core/utils/errorHandler");
const status = require("../../../core/constants/httpStatus");

router.post("/", authMiddleware.authenticate, questionController.createQuestion);
router.get("/", questionController.getQuestions);
router.get("/:id", questionController.getSingleQuestion);
router.patch("/:id", authMiddleware.authenticate, questionController.updateQuestion);
router.delete("/:id", authMiddleware.authenticate, questionController.deleteQuestion);

router.all('', (req, res, next) => {
  next(AppError.create('Route not found', 404, status.Fail));
});

module.exports = router;




