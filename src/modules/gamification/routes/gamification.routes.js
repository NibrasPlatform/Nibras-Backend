const express = require("express");
const { authenticate } = require("../../../core/middlewares/auth.middleware");
const gamificationController = require("../controllers/gamification.controller");

const router = express.Router();

router.post("/check-award", authenticate, gamificationController.checkAndAwardBadges);
router.get("/all-badges", authenticate, gamificationController.getAllBadges);

module.exports = router;
