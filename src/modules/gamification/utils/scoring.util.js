const PROBLEM_POINTS_BY_DIFFICULTY = Object.freeze({
  beginner: 10,
  newbie: 20,
  intermediate: 35,
  advanced: 50,
});

const PROBLEM_DIFFICULTY_WEIGHTS = Object.freeze({
  beginner: 1,
  newbie: 2,
  intermediate: 3,
  advanced: 4,
});

const COMMUNITY_EVENT_POINTS = Object.freeze({
  question_created: 5,
  answer_created: 15,
  accepted_answer: 25,
  thread_created: 5,
  badge_awarded: 15,
});

const CONTEST_EVENT_POINTS = Object.freeze({
  contest_joined: 15,
  contest_top_25: 25,
  contest_top_10: 50,
});

const COURSE_EVENT_POINTS = Object.freeze({
  lesson_completed: 2,
  section_completed: 5,
  course_completed: 100,
  assignment_submitted: 10,
  assignment_approved: 20,
  high_grade: 15,
  daily_learning_activity: 3,
  learning_streak: 25,
});

const getProblemSolvedPoints = (difficulty) => PROBLEM_POINTS_BY_DIFFICULTY[String(difficulty || "").toLowerCase()] || 0;

const getProblemDifficultyWeight = (difficulty) =>
  PROBLEM_DIFFICULTY_WEIGHTS[String(difficulty || "").toLowerCase()] || 0;

const getContestRatingGainPoints = (ratingChange) => {
  const normalized = Math.max(Number(ratingChange) || 0, 0);
  return Math.min(Math.floor(normalized / 10), 30);
};

const normalizeProgressPercentage = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(100, numeric));
};

const getCourseProgressBonusPoints = (newProgressPercentage, previousProgressPercentage = 0) => {
  const next = normalizeProgressPercentage(newProgressPercentage);
  const previous = normalizeProgressPercentage(previousProgressPercentage);
  const delta = Math.max(next - previous, 0);
  return Math.round(delta * 0.5 * 100) / 100;
};

const getHighGradeBonusPoints = (grade) => {
  const numeric = Number(grade);
  if (!Number.isFinite(numeric)) return 0;
  return numeric > 85 ? COURSE_EVENT_POINTS.high_grade : 0;
};

module.exports = {
  COMMUNITY_EVENT_POINTS,
  CONTEST_EVENT_POINTS,
  COURSE_EVENT_POINTS,
  PROBLEM_POINTS_BY_DIFFICULTY,
  PROBLEM_DIFFICULTY_WEIGHTS,
  getProblemSolvedPoints,
  getProblemDifficultyWeight,
  getContestRatingGainPoints,
  getCourseProgressBonusPoints,
  getHighGradeBonusPoints,
};
