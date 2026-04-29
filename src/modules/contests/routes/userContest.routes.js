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
router.post("/:id/bookmark", contestIdValidator, valid, bookmarkContest);
router.delete("/:id/bookmark", contestIdValidator, valid, unbookmarkContest);
router.get("/bookmarks", paginationValidator, valid, getBookmarkedContests);
router.post("/:id/join", contestIdValidator, valid, joinContest);

// Reminder routes
router.post("/:id/reminder", contestIdValidator, valid, setReminder);
router.delete("/:id/reminder", contestIdValidator, valid, removeReminder);
router.get("/reminders", paginationValidator, valid, getReminders);
router.get("/history", participationHistoryValidator, valid, getParticipationHistory);

module.exports = router;
