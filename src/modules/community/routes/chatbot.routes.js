/**
 * Chatbot Routes
 */
const express = require("express");
const router = express.Router();
const { authenticate } = require("../../../core/middlewares/auth.middleware");
const rateLimiter = require("../../../core/middlewares/rateLimiter.middleware");
const {
  chatbotAskValidator,
  chatbotPublishValidator,
  validationErrorHandler,
} = require("../validation/chatbot.validator.js");
const {
  askChatbot,
  publishChatbotAnswer,
} = require("../controllers/chatbot.controller.js");

/**
 * POST /api/chatbot/ask
 * Ask the chatbot a question
 * Rate limited to 10 requests per minute
 */
router.post(
  "/ask",
  authenticate,
  rateLimiter.middleware(5, 60000),
  chatbotAskValidator,
  validationErrorHandler,
  askChatbot,
);

/**
 * POST /api/chatbot/publish
 * Publish chatbot answer to community
 * Rate limited to 10 requests per minute
 */
router.post(
  "/publish",
  authenticate,
  rateLimiter.middleware(10, 60000),
  chatbotPublishValidator,
  validationErrorHandler,
  publishChatbotAnswer,
);

module.exports = router;
