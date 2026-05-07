const { body } = require("express-validator");

exports.createThreadValidator = [
    body("title")
        .notEmpty()
        .withMessage("Thread title is required")
        .isLength({ max: 300 })
        .withMessage("Title cannot exceed 300 characters"),

    body("body")
        .notEmpty()
        .withMessage("Thread body is required"),

    body("tags")
        .optional()
        .isArray()
        .withMessage("Tags must be an array"),
];

exports.updateThreadValidator = [
    body("title")
        .optional()
        .notEmpty()
        .withMessage("Title cannot be empty")
        .isLength({ max: 300 })
        .withMessage("Title cannot exceed 300 characters"),

    body("body")
        .optional()
        .notEmpty()
        .withMessage("Body cannot be empty"),

    body("tags")
        .optional()
        .isArray()
        .withMessage("Tags must be an array"),
];
