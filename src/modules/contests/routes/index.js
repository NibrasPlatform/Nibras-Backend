const express = require("express");
const contestsRoutes = require("./contests.routes");
const accountRoutes = require("./account.routes");
const userContestRoutes = require("./userContest.routes");

const router = express.Router();

router.use("/", contestsRoutes);
router.use("/accounts", accountRoutes);
router.use("/user-contests", userContestRoutes);

module.exports = router;
