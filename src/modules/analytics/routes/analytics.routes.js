const express = require("express");
const { authenticate } = require("../../../core/middlewares/auth.middleware");
const controller = require("../controllers/analytics.controller");

const router = express.Router();

router.get("/dashboard/:studentId", authenticate, controller.getDashboardData);

module.exports = router;
