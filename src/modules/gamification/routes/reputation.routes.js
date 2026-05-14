const express = require("express");
const { authenticate } = require("../../../core/middlewares/auth.middleware");
const gamificationController = require("../controllers/gamification.controller");

const router = express.Router();

router.get("/me", authenticate, gamificationController.getMyReputation);

module.exports = router;
