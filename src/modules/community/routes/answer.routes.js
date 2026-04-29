const express = require("express");
const router = express.Router();
const answerController = require("../controllers/answer.controller.js");
const authMiddleware = require("../../../core/middlewares/auth.middleware");
const status = require("../../../core/constants/httpStatus");
const AppError = require("../../../core/utils/errorHandler");

router.post("/:questionId", authMiddleware.authenticate, answerController.createAnswer);
router.get("/question/:questionId", answerController.getAnswersForQuestion);
router.get("/user/:userId", answerController.getAnswersForUser);
router.get("/:questionId/:id", answerController.getAnswerById);
router.patch("/:questionId/:id", authMiddleware.authenticate, answerController.updateAnswer);
router.delete("/:questionId/:id", authMiddleware.authenticate, answerController.deleteAnswer);
router.patch("/:questionId/:id/accept", authMiddleware.authenticate, answerController.acceptAnswer);

router.all('', (req, res, next) => {
    next(AppError.create('Route not found', 404, status.Fail));
});

module.exports = router;
