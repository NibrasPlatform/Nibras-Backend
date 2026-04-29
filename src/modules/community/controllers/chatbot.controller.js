/**
 * Chatbot Controller
 */
const chatbotService = require('../services/chatbot.service.js');
const AppError = require("../../../core/utils/errorHandler");
const logger = require("../../../core/utils/logger");
const status = require("../../../core/constants/httpStatus");

/**
 * POST /api/chatbot/ask
 * Ask the chatbot a question
 */
const askChatbot = async (req, res, next) => {
  try {
    const { question } = req.body;

    logger.info('Chatbot ask request', {
      userId: req.user?._id,
      questionLength: question?.length,
    });

    const response = await chatbotService.processChatbotQuestion(question);

    logger.info('Chatbot response sent', {
      userId: req.user?._id,
      hintsCount: response.hints.length,
    });

    res.status(200).json({
      message: 'Answer generated successfully',
      data: {
        question,
        hints: response.hints,
        tags: response.tags,
        finalAnswer: response.finalAnswer,
        communityQuestion: response.communityQuestion,
      },
    });
  } catch (error) {
    logger.error('Chatbot ask error', {
      userId: req.user?._id,
      error: error.message,
    });
    const statusCode = error.statusCode || 400;
    const statusText = error.statusText || status.Fail;
    next(AppError.create(error.message, statusCode, statusText));
  }
};

/**
 * POST /api/chatbot/publish
 * Publish chatbot answer to community as a question (by user) and answer (by AI)
 */
const publishChatbotAnswer = async (req, res, next) => {
  try {
    const { title, question, finalAnswer , tags} = req.body;

    logger.info('Chatbot publish request', {
      userId: req.user?._id,
      title,
      tags: tags || [],
    });

    const result = await chatbotService.publishChatbotAnswer(
      req.user._id,
      title,
      question,
      finalAnswer,
      tags
    );

    logger.info('Chatbot answer published', {
      userId: req.user?._id,
      questionId: result.question._id,
      answerId: result.answer._id,
      tags: result.tags || [],
    });

    res.status(201).json({
      message: 'Published to community successfully',
      data: {
        title: result.title,
        question: result.question,
        answer: result.answer,
        tags: result.tags,
      },
    });
  } catch (error) {
    logger.error('Chatbot publish error', {
      userId: req.user?._id,
      error: error.message,
    });
    const statusCode = error.statusCode || 400;
    const statusText = error.statusText || status.Fail;
    next(AppError.create(error.message, statusCode, statusText));
  }
};

module.exports = {
  askChatbot,
  publishChatbotAnswer,
};
