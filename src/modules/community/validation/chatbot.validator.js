/**
 * Chatbot Validators
 */
const { body, validationResult } = require('express-validator');

const chatbotAskValidator = [
  body('question')
    .trim()
    .notEmpty()
    .withMessage('Question is required')
    .isLength({ min: 10 })
    .withMessage('Question must be at least 10 characters')
    .isLength({ max: 1000 })
    .withMessage('Question cannot exceed 1000 characters'),
];

/**
 * Validation error handler
 */
const validationErrorHandler = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      message: 'Validation error',
      errors: errors.array().map((err) => ({
        field: err.path,
        message: err.msg,
      })),
    });
  }
  next();
};

const chatbotPublishValidator = [
  body('title')
    .trim()
    .notEmpty()
    .withMessage('Title is required')
    .isLength({ max: 300 })
    .withMessage('Title cannot exceed 300 characters'),
  body('question')
    .trim()
    .notEmpty()
    .withMessage('Question is required')
    .isLength({ min: 10 })
    .withMessage('Question must be at least 10 characters')
    .isLength({ max: 1000 })
    .withMessage('Question cannot exceed 1000 characters'),
  body('finalAnswer')
    .trim()
    .notEmpty()
    .withMessage('Final answer is required'),
];

module.exports = {
  chatbotAskValidator,
  chatbotPublishValidator,
  validationErrorHandler,
};
