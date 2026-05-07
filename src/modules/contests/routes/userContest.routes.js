const router = require("express").Router();
const {
  bookmarkContest,
  unbookmarkContest,
  getBookmarkedContests,
  setReminder,
  removeReminder,
  getReminders,
  joinContest,
  getParticipationHistory,
} = require("../controllers/userContest.controller");
const authMiddleware = require("../../../core/middlewares/auth.middleware");
const {
  contestIdValidator,
  paginationValidator,
  participationHistoryValidator,
} = require("../validation/userContest.validator");
const valid = require("../../../core/middlewares/validation.middleware");

// All routes require authentication
router.use(authMiddleware.authenticate);

// Bookmark routes
router.post("/:id/bookmark", valid(contestIdValidator), bookmarkContest);
router.delete("/:id/bookmark", valid(contestIdValidator), unbookmarkContest);
router.get("/bookmarks", valid(paginationValidator), getBookmarkedContests);
router.post("/:id/join", valid(contestIdValidator), joinContest);

// Reminder routes
router.post("/:id/reminder", valid(contestIdValidator), setReminder);
router.delete("/:id/reminder", valid(contestIdValidator), removeReminder);
router.get("/reminders", valid(paginationValidator), getReminders);
router.get("/history", valid(participationHistoryValidator), getParticipationHistory);

module.exports = router;
