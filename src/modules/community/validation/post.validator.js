const { body } = require("express-validator");

exports.createPostValidator = [
    body("body")
        .notEmpty()
        .withMessage("Post body is required")
        .isLength({ max: 5000 })
        .withMessage("Post body cannot exceed 5000 characters"),
];

exports.updatePostValidator = [
    body("body")
        .optional()
        .notEmpty()
        .withMessage("Body cannot be empty")
        .isLength({ max: 5000 })
        .withMessage("Post body cannot exceed 5000 characters"),
];
