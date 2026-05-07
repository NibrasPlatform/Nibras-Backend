const express = require("express");
const questionRoutes = require("./question.routes");
const answerRoutes = require("./answer.routes");
const tagRoutes = require("./tag.routes");
const threadRoutes = require("./thread.routes");
const postRoutes = require("./post.routes");
const voteRoutes = require("./vote.routes");
const chatbotRoutes = require("./chatbot.routes");

const router = express.Router();

router.use("/questions", questionRoutes);
router.use("/answers", answerRoutes);
router.use("/tags", tagRoutes);
router.use("/threads", threadRoutes);
router.use("/posts", postRoutes);
router.use("/votes", voteRoutes);
router.use("/chatbot", chatbotRoutes);

module.exports = router;
