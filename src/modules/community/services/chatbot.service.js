const crypto = require('crypto');
const axios = require('axios');
const logger = require("../../../core/utils/logger");
const User = require("../../users/models/user.model");
const Role = require("../../auth/models/role.model");
const Question = require('../models/question.model.js');
const Answer = require('../models/answer.model.js');
const Tag = require('../models/tag.model.js');
const { createAnswer } = require('./answer.service.js');

const AI_SERVICE_URL = process.env.AI_SERVICE_URL;
const AI_TIMEOUT = Number(process.env.AI_TIMEOUT) || 300000;

const callAIService = async (question, retryCount = 0) => {
    try {
        logger.info('AI Service Call', {
            question,
            timestamp: new Date().toISOString(),
        });

        const response = await axios.post(
            AI_SERVICE_URL,
            { question },
            { timeout: AI_TIMEOUT }
        );
        console.log('AI Service Response:', response.data);
        
        if (response.data.type === "refused") {
            throw new Error('The question is too vague and does not specify a context related to computer science. Please provide more details or clarify your question.');
        }

        if (!response.data || !response.data.data.hints || !response.data.data.answer|| !response.data.data.tags.length) {
            throw new Error('Invalid AI service response format');
        }
        const formattedResponse = {
            question,
            hints: response.data.data.hints,
            finalAnswer: response.data.data.answer,
            tags: response.data.data.tags,
            xai: response.data.data.xai || null,
        };
        if(response.data.type === "community_match"){formattedResponse.communityQuestion = response.data.data.question_id;}
        
        logger.info('AI Service Success', {
            question,
            hintsCount: formattedResponse.hints.length,
            answer: formattedResponse.finalAnswer,
            tagsCount: formattedResponse.tags.length,
            communityQuestion: formattedResponse.communityQuestion,
            xai: formattedResponse.xai,
        });

        return formattedResponse;
    } catch (error) {
        logger.error('AI Service Error', {
            question,
            error: error.message,
            code: error.code,
            retryCount,
        });

        if (error.code === 'ECONNABORTED') {
            throw new Error('AI service took too long to respond. Please try again.');
        }

        if (retryCount === 0 && error.code === 'ECONNREFUSED') {
            logger.info('Retrying AI Service', { question });
            return callAIService(question, retryCount + 1);
        }

        if (error.response?.status === 500) {
            throw new Error('AI service is currently unavailable. Please try again later.');
        }

        if (error.code === 'ECONNREFUSED') {
            throw new Error('Cannot connect to AI service. Please try again later.');
        }

        throw new Error(error.message || 'AI service error');
    }
};

const validateQuestion = (question) => {
    const MIN_LENGTH = 10;
    const MAX_LENGTH = 1000;

    if (!question || typeof question !== 'string') {
        throw new Error('Question must be a non-empty string');
    }

    const trimmedQuestion = question.trim();

    if (trimmedQuestion.length < MIN_LENGTH) {
        throw new Error(`Question must be at least ${MIN_LENGTH} characters`);
    }

    if (trimmedQuestion.length > MAX_LENGTH) {
        throw new Error(`Question cannot exceed ${MAX_LENGTH} characters`);
    }

    return trimmedQuestion;
};

const processChatbotQuestion = async (question) => {
    const validatedQuestion = validateQuestion(question);
    return await callAIService(validatedQuestion);
};

const getOrCreateAIUser = async () => {
    const AI_EMAIL = 'ai-assistant@system.local';

    const adminRole = await Role.findOne({ name: "Admin" });
    if (!adminRole) {
        throw new Error("Admin role not found. Please run seed:roles first.");
    }

    const aiUser = await User.findOneAndUpdate(
        { email: AI_EMAIL },
        {
            $setOnInsert: {
                name: 'AI Assistant',
                email: AI_EMAIL,
                password: crypto.randomBytes(32).toString('hex'),
                isSystemUser: true,
                role: adminRole._id,
            },
        },
        { upsert: true, returnDocument: "after" }
    );
    return aiUser;
};

const publishChatbotAnswer = async (userId, title, question, finalAnswer, tags) => {
    const aiUser = await getOrCreateAIUser();
    
    const tagsIDs = [];
    if (tags && Array.isArray(tags)) {
        for (const tagName of tags) {
            try {
                const tag = await Tag.findOne({ name: { $regex: new RegExp(`^${tagName}$`, 'i') } });
                if (tag) {
                    tagsIDs.push(tag._id);
                } else {
                    logger.warn(`Tag "${tagName}" not found, skipping`);
                }
            } catch (err) {
                logger.error('Error fetching tag', { tagName, error: err.message });
            }
        }
    }
    
    const communityQuestion = await Question.create({
        title,
        body: question,
        author: userId,
        tags: tagsIDs,
    });

    const saved = await communityQuestion.save();
    let aiAnswer;
    try {
        aiAnswer = await createAnswer({
            body: finalAnswer,
            author: aiUser._id,
            question: communityQuestion._id,
            isFromAI: true,
        });
    } catch (err) {
        await Question.findByIdAndDelete(communityQuestion._id);
        throw err;
    }

    const populatedAnswer = await Answer.findById(aiAnswer._id).populate('author');

    const populatedQuestion = await Question.findById(communityQuestion._id)
    .populate('tags');

    const questionObj = populatedQuestion.toObject();
    questionObj.tags = populatedQuestion.tags.map(t => t.name);
    
    // console.log('Final question object:', questionObj);
    // console.log('Final answer object:', populatedAnswer);

    return { question: questionObj, answer: populatedAnswer };
};

module.exports = {
    processChatbotQuestion,
    callAIService,
    validateQuestion,
    publishChatbotAnswer,
};
