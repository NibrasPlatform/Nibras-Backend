const catchAsync = require("../../../core/utils/catchAsync");
const AppError = require("../../../core/utils/errorHandler");
const mongoose = require("mongoose");
const Problem = require("../models/problem.model");
const UserProblemProgress = require("../models/userProblemProgress.model");
const problemMetadataService = require("../services/problemMetadata.service");

const DIFFICULTY_ORDER = { beginner: 0, newbie: 1, intermediate: 2, advanced: 3 };
const DIFFICULTIES = Object.keys(DIFFICULTY_ORDER);

const parseTagsFilter = (tagsQuery) => {
  if (!tagsQuery) return [];
  if (Array.isArray(tagsQuery)) {
    return [...new Set(tagsQuery.map((tag) => String(tag).trim().toLowerCase()).filter(Boolean))];
  }
  return [...new Set(String(tagsQuery).split(",").map((tag) => tag.trim().toLowerCase()).filter(Boolean))];
};

const toProblemCard = (problem, isSolved = false) => ({
  id: problem._id,
  title: problem.title,
  platform: problem.platform,
  url: problem.url,
  difficulty: problem.difficulty,
  tags: problem.tags,
  rating: problem.rating,
  isCore: problem.isCore,
  order: problem.order,
  isSolved,
});

const getProblems = catchAsync(async (req, res) => {
  const { difficulty, tags } = req.query;
  const filter = {};
  if (difficulty) filter.difficulty = difficulty;
  const tagFilter = parseTagsFilter(tags);
  if (tagFilter.length) filter.tags = { $in: tagFilter };

  const problems = await Problem.find(filter).sort({ createdAt: -1 }).lean();
  const problemIds = problems.map((p) => p._id);

  const solvedRows = await UserProblemProgress.find({
    userId: req.user._id,
    problemId: { $in: problemIds },
    solved: true,
  }).select("problemId").lean();

  const solvedSet = new Set(solvedRows.map((r) => String(r.problemId)));
  const data = problems.map((p) => toProblemCard(p, solvedSet.has(String(p._id))));

  res.status(200).json({ success: true, message: "Problems fetched successfully", data });
});

const createProblem = catchAsync(async (req, res) => {
  const metadata = await problemMetadataService.fetchFromUrl(req.body.url);
  const problem = await Problem.create({
    title: metadata.title,
    platform: metadata.platform,
    url: req.body.url,
    difficulty: metadata.difficulty,
    tags: metadata.tags,
    rating: metadata.rating,
    isCore: req.body.isCore ?? false,
    order: req.body.order ?? 0,
  });
  res.status(201).json({ success: true, message: "Problem created successfully", data: toProblemCard(problem.toObject()) });
});

const updateProblem = catchAsync(async (req, res) => {
  const problem = await Problem.findById(req.params.id);
  if (!problem) throw AppError.create("Problem not found", 404, "fail");

  const updatableFields = ["title", "platform", "url", "difficulty", "tags", "rating", "isCore", "order"];
  updatableFields.forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(req.body, field)) {
      problem[field] = req.body[field];
    }
  });
  await problem.save();

  res.status(200).json({ success: true, message: "Problem updated successfully", data: toProblemCard(problem.toObject()) });
});

const deleteProblem = catchAsync(async (req, res) => {
  const deleted = await Problem.findByIdAndDelete(req.params.id);
  if (!deleted) throw AppError.create("Problem not found", 404, "fail");
  await UserProblemProgress.deleteMany({ problemId: deleted._id });
  res.status(200).json({ success: true, message: "Problem deleted successfully" });
});

const setProblemSolvedStatus = catchAsync(async (req, res) => {
  throw AppError.create(
    "Manual problem marking is disabled. Problems are marked automatically when syncing your competitive profile.",
    403,
    "fail"
  );
});

const getProgressByDifficulty = catchAsync(async (req, res) => {
  const [totalPerDifficulty, solvedPerDifficulty] = await Promise.all([
    Problem.aggregate([{ $group: { _id: "$difficulty", total: { $sum: 1 } } }]),
    UserProblemProgress.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(String(req.user._id)), solved: true } },
      { $lookup: { from: "problems", localField: "problemId", foreignField: "_id", as: "problem" } },
      { $unwind: "$problem" },
      { $group: { _id: "$problem.difficulty", solved: { $sum: 1 } } },
    ]),
  ]);

  const progress = DIFFICULTIES.reduce((acc, d) => { acc[d] = { total: 0, solved: 0 }; return acc; }, {});
  totalPerDifficulty.forEach((r) => { if (progress[r._id]) progress[r._id].total = r.total; });
  solvedPerDifficulty.forEach((r) => { if (progress[r._id]) progress[r._id].solved = r.solved; });

  res.status(200).json({ success: true, message: "Progress fetched successfully", data: progress });
});

const getRoadmap = catchAsync(async (req, res) => {
  const problems = await Problem.find({ isCore: true }).lean();
  const problemIds = problems.map((p) => p._id);

  const solvedRows = await UserProblemProgress.find({
    userId: req.user._id,
    problemId: { $in: problemIds },
    solved: true,
  }).select("problemId").lean();

  const solvedSet = new Set(solvedRows.map((r) => String(r.problemId)));

  const sorted = problems.sort((a, b) => {
    const diff = (DIFFICULTY_ORDER[a.difficulty] ?? Number.MAX_SAFE_INTEGER) - (DIFFICULTY_ORDER[b.difficulty] ?? Number.MAX_SAFE_INTEGER);
    if (diff !== 0) return diff;
    if ((a.order ?? 0) !== (b.order ?? 0)) return (a.order ?? 0) - (b.order ?? 0);
    return a.title.localeCompare(b.title);
  });

  const roadmapByDifficulty = DIFFICULTIES.reduce((acc, d) => { acc[d] = []; return acc; }, {});
  sorted.forEach((p) => {
    if (roadmapByDifficulty[p.difficulty]) {
      roadmapByDifficulty[p.difficulty].push(toProblemCard(p, solvedSet.has(String(p._id))));
    }
  });

  const roadmap = DIFFICULTIES.flatMap((d) => roadmapByDifficulty[d]);
  res.status(200).json({ success: true, message: "Roadmap fetched successfully", data: { roadmap, byDifficulty: roadmapByDifficulty } });
});

module.exports = { getProblems, createProblem, updateProblem, deleteProblem, setProblemSolvedStatus, getProgressByDifficulty, getRoadmap };
