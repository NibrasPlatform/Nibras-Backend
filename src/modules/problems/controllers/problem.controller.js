const mongoose = require("mongoose");
const Problem = require("../models/problem.model");
const UserProblemProgress = require("../models/userProblemProgress.model");
const problemMetadataService = require("../services/problemMetadata.service");

const DIFFICULTY_ORDER = {
  beginner: 0,
  newbie: 1,
  intermediate: 2,
  advanced: 3,
};

const DIFFICULTIES = Object.keys(DIFFICULTY_ORDER);

const formatErrorResponse = (res, statusCode, message) => {
  return res.status(statusCode).json({
    status: statusCode,
    error: message,
  });
};

const handleMongoError = (res, error) => {
  if (error?.statusCode) {
    return formatErrorResponse(res, error.statusCode, error.message);
  }

  if (error?.code === 11000) {
    return formatErrorResponse(res, 409, "Problem URL already exists");
  }

  if (error?.name === "ValidationError") {
    return formatErrorResponse(res, 400, error.message);
  }

  return formatErrorResponse(res, 500, error.message);
};

const parseTagsFilter = (tagsQuery) => {
  if (!tagsQuery) {
    return [];
  }

  if (Array.isArray(tagsQuery)) {
    return [...new Set(tagsQuery.map((tag) => String(tag).trim().toLowerCase()).filter(Boolean))];
  }

  return [
    ...new Set(
      String(tagsQuery)
        .split(",")
        .map((tag) => tag.trim().toLowerCase())
        .filter(Boolean)
    ),
  ];
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

const getProblems = async (req, res) => {
  try {
    const { difficulty, tags } = req.query;
    const filter = {};

    if (difficulty) {
      filter.difficulty = difficulty;
    }

    const tagFilter = parseTagsFilter(tags);
    if (tagFilter.length) {
      filter.tags = { $in: tagFilter };
    }

    const problems = await Problem.find(filter)
      .sort({ createdAt: -1 })
      .lean();

    const problemIds = problems.map((problem) => problem._id);
    const solvedRows = await UserProblemProgress.find({
      userId: req.user._id,
      problemId: { $in: problemIds },
      solved: true,
    })
      .select("problemId")
      .lean();

    const solvedProblemIds = new Set(solvedRows.map((row) => String(row.problemId)));
    const data = problems.map((problem) =>
      toProblemCard(problem, solvedProblemIds.has(String(problem._id)))
    );

    return res.status(200).json({
      status: 200,
      data,
    });
  } catch (error) {
    return handleMongoError(res, error);
  }
};

const createProblem = async (req, res) => {
  try {
    const metadata = await problemMetadataService.fetchFromUrl(req.body.url);

    const payload = {
      title: metadata.title,
      platform: metadata.platform,
      url: req.body.url,
      difficulty: metadata.difficulty,
      tags: metadata.tags,
      rating: metadata.rating,
      isCore: req.body.isCore ?? false,
      order: req.body.order ?? 0,
    };

    const problem = await Problem.create(payload);

    return res.status(201).json({
      status: 201,
      message: "Problem created successfully",
      data: toProblemCard(problem.toObject()),
    });
  } catch (error) {
    return handleMongoError(res, error);
  }
};

const updateProblem = async (req, res) => {
  try {
    const { id } = req.params;
    const problem = await Problem.findById(id);

    if (!problem) {
      return formatErrorResponse(res, 404, "Problem not found");
    }

    const updatableFields = [
      "title",
      "platform",
      "url",
      "difficulty",
      "tags",
      "rating",
      "isCore",
      "order",
    ];

    updatableFields.forEach((field) => {
      if (Object.prototype.hasOwnProperty.call(req.body, field)) {
        problem[field] = req.body[field];
      }
    });

    await problem.save();

    return res.status(200).json({
      status: 200,
      message: "Problem updated successfully",
      data: toProblemCard(problem.toObject()),
    });
  } catch (error) {
    return handleMongoError(res, error);
  }
};

const deleteProblem = async (req, res) => {
  try {
    const { id } = req.params;
    const deletedProblem = await Problem.findByIdAndDelete(id);

    if (!deletedProblem) {
      return formatErrorResponse(res, 404, "Problem not found");
    }

    await UserProblemProgress.deleteMany({ problemId: deletedProblem._id });

    return res.status(200).json({
      status: 200,
      message: "Problem deleted successfully",
    });
  } catch (error) {
    return handleMongoError(res, error);
  }
};

const setProblemSolvedStatus = async (req, res) => {
  try {
    return formatErrorResponse(res, 403, "Manual problem marking is disabled. Problems are marked automatically when syncing your competitive profile.");
  } catch (error) {
    return handleMongoError(res, error);
  }
};

const getProgressByDifficulty = async (req, res) => {
  try {
    const totalPerDifficulty = await Problem.aggregate([
      {
        $group: {
          _id: "$difficulty",
          total: { $sum: 1 },
        },
      },
    ]);

    const solvedPerDifficulty = await UserProblemProgress.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(String(req.user._id)),
          solved: true,
        },
      },
      {
        $lookup: {
          from: "problems",
          localField: "problemId",
          foreignField: "_id",
          as: "problem",
        },
      },
      { $unwind: "$problem" },
      {
        $group: {
          _id: "$problem.difficulty",
          solved: { $sum: 1 },
        },
      },
    ]);

    const progress = DIFFICULTIES.reduce((acc, difficulty) => {
      acc[difficulty] = { total: 0, solved: 0 };
      return acc;
    }, {});

    totalPerDifficulty.forEach((row) => {
      if (progress[row._id]) {
        progress[row._id].total = row.total;
      }
    });

    solvedPerDifficulty.forEach((row) => {
      if (progress[row._id]) {
        progress[row._id].solved = row.solved;
      }
    });

    return res.status(200).json({
      status: 200,
      data: progress,
    });
  } catch (error) {
    return handleMongoError(res, error);
  }
};

const getRoadmap = async (req, res) => {
  try {
    const problems = await Problem.find({ isCore: true }).lean();

    const problemIds = problems.map((problem) => problem._id);
    const solvedRows = await UserProblemProgress.find({
      userId: req.user._id,
      problemId: { $in: problemIds },
      solved: true,
    })
      .select("problemId")
      .lean();

    const solvedProblemIds = new Set(solvedRows.map((row) => String(row.problemId)));

    const sorted = problems.sort((a, b) => {
      const diffCompare =
        (DIFFICULTY_ORDER[a.difficulty] ?? Number.MAX_SAFE_INTEGER) -
        (DIFFICULTY_ORDER[b.difficulty] ?? Number.MAX_SAFE_INTEGER);

      if (diffCompare !== 0) {
        return diffCompare;
      }

      if ((a.order ?? 0) !== (b.order ?? 0)) {
        return (a.order ?? 0) - (b.order ?? 0);
      }

      return a.title.localeCompare(b.title);
    });

    const roadmapByDifficulty = DIFFICULTIES.reduce((acc, difficulty) => {
      acc[difficulty] = [];
      return acc;
    }, {});

    sorted.forEach((problem) => {
      const bucket = roadmapByDifficulty[problem.difficulty];
      if (bucket) {
        const isSolved = solvedProblemIds.has(String(problem._id));
        bucket.push(toProblemCard(problem, isSolved));
      }
    });

    const roadmap = DIFFICULTIES.flatMap((difficulty) => roadmapByDifficulty[difficulty]);

    return res.status(200).json({
      status: 200,
      data: {
        roadmap,
        byDifficulty: roadmapByDifficulty,
      },
    });
  } catch (error) {
    return handleMongoError(res, error);
  }
};

module.exports = {
  getProblems,
  createProblem,
  updateProblem,
  deleteProblem,
  setProblemSolvedStatus,
  getProgressByDifficulty,
  getRoadmap,
};
