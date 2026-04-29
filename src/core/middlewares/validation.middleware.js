const { validationResult } = require("express-validator");
const AppError = require("../utils/errorHandler");

const validate = (schema, property = "body") => {
  return (req, res, next) => {
    if (schema && typeof schema.validate === "function") {
      const payload = req[property];
      const { error, value } = schema.validate(payload, {
        abortEarly: false,
        stripUnknown: true,
      });

      if (error) {
        return next(
          AppError.create("Validation failed", 400, "fail", {
            details: error.details.map((detail) => detail.message),
          })
        );
      }

      req[property] = value;
      return next();
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(
        AppError.create("Validation failed", 400, "fail", {
          details: errors.array(),
        })
      );
    }

    return next();
  };
};

module.exports = validate;
