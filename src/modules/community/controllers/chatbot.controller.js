/**
 * Chatbot Controller
 */
const catchAsync = require("../../../core/utils/catchAsync");
const chatbotService = require("../services/chatbot.service.js");
const logger = require("../../../core/utils/logger");

/**
 * POST /api/chatbot/ask
 * Ask the chatbot a question
 */
const askChatbot = catchAsync(async (req, res) => {
    const { question } = req.body;

    logger.info("Chatbot ask request", {
        userId: req.user?._id,
        questionLength: question?.length,
    });

    const response = await chatbotService.processChatbotQuestion(question);

    logger.info("Chatbot response sent", {
        userId: req.user?._id,
        hintsCount: response.hints.length,
    });

    res.status(200).json({
        success: true,
        message: "Answer generated successfully",
        data: {
            question,
            hints: response.hints,
            tags: response.tags,
            finalAnswer: response.finalAnswer,
            communityQuestion: response.communityQuestion,
        },
    });
});

/**
 * POST /api/chatbot/publish
 * Publish chatbot answer to community as a question (by user) and answer (by AI)
 */
const publishChatbotAnswer = catchAsync(async (req, res) => {
    const { title, question, finalAnswer, tags } = req.body;

    logger.info("Chatbot publish request", {
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

    logger.info("Chatbot answer published", {
        userId: req.user?._id,
        questionId: result.question._id,
        answerId: result.answer._id,
        tags: result.tags || [],
    });

    res.status(201).json({
        success: true,
        message: "Published to community successfully",
        data: {
            title: result.title,
            question: result.question,
            answer: result.answer,
            tags: result.tags,
        },
    });
});

module.exports = {
    askChatbot,
    publishChatbotAnswer,
};
