const express = require("express");
const aiController = require("./ai.controller");
const { authenticate } = require("../../core/middlewares/auth.middleware");

const router = express.Router();

router.get("/grades", authenticate, aiController.getGrades);
router.get("/", authenticate, aiController.getGrades);
module.exports = router;
