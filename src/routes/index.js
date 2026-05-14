const express = require("express");

const authRoutes = require("../modules/auth/routes/auth.routes");
const usersRoutes = require("../modules/users/routes/users.routes");
const coursesRoutes = require("../modules/courses/routes/courses.routes");
const submissionsRoutes = require("../modules/courses/routes/submissions.routes");
const aiRoutes = require("../modules/ai/ai.routes");
const assignmentsRoutes = require("../modules/assignments/routes/assignments.routes");
const contestsRoutes = require("../modules/contests/routes");
const problemsRoutes = require("../modules/problems/routes/problems.routes");
const communityRoutes = require("../modules/community/routes/community.routes");
const gamificationRoutes = require("../modules/gamification/routes/gamification.routes");
const reputationRoutes = require("../modules/gamification/routes/reputation.routes");
const analyticsRoutes = require("../modules/analytics/routes/analytics.routes");
const mentorshipRoutes = require("../modules/mentorship/routes/mentorship.routes");

const router = express.Router();

router.use("/auth", authRoutes);
router.use("/users", usersRoutes);
router.use("/courses", coursesRoutes);
router.use("/submissions", submissionsRoutes);
router.use("/ai", aiRoutes);
router.use("/assignments", assignmentsRoutes);
router.use("/contests", contestsRoutes);
router.use("/problems", problemsRoutes);
router.use("/community", communityRoutes);
router.use("/gamification", gamificationRoutes);
router.use("/reputation", reputationRoutes);
router.use("/analytics", analyticsRoutes);
router.use("/mentorship", mentorshipRoutes);

module.exports = router;
