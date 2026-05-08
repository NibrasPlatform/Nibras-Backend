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

const getProblemSolvedPoints = (difficulty) => PROBLEM_POINTS_BY_DIFFICULTY[String(difficulty || "").toLowerCase()] || 0;

const getProblemDifficultyWeight = (difficulty) =>
  PROBLEM_DIFFICULTY_WEIGHTS[String(difficulty || "").toLowerCase()] || 0;

const getContestRatingGainPoints = (ratingChange) => {
  const normalized = Math.max(Number(ratingChange) || 0, 0);
  return Math.min(Math.floor(normalized / 10), 30);
};

module.exports = {
  COMMUNITY_EVENT_POINTS,
  CONTEST_EVENT_POINTS,
  PROBLEM_POINTS_BY_DIFFICULTY,
  PROBLEM_DIFFICULTY_WEIGHTS,
  getProblemSolvedPoints,
  getProblemDifficultyWeight,
  getContestRatingGainPoints,
};
