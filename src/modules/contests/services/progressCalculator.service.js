const mongoose = require("mongoose");
const Problem = require("../../problems/models/problem.model");
const UserProblemProgress = require("../../problems/models/userProblemProgress.model");

class ProgressCalculator {
  async calculateUserProgress(userId) {
    const userIdObj = new mongoose.Types.ObjectId(String(userId));

    const totalByPlatformDifficulty = await Problem.aggregate([
      {
        $group: {
          _id: {
            platform: "$platform",
            difficulty: "$difficulty",
          },
          count: { $sum: 1 },
        },
      },
    ]);

    const solvedByPlatformDifficulty = await UserProblemProgress.aggregate([
      {
        $match: {
          userId: userIdObj,
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
          _id: {
            platform: "$problem.platform",
            difficulty: "$problem.difficulty",
          },
          count: { $sum: 1 },
        },
      },
    ]);

    const totalSolvedCount = await UserProblemProgress.countDocuments({
      userId: userIdObj,
      solved: true,
    });

    const totalProblemsCount = await Problem.countDocuments();

    const progress = {
      overall: {
        total: totalProblemsCount,
        solved: totalSolvedCount,
        percentage: totalProblemsCount > 0 ? Math.round((totalSolvedCount / totalProblemsCount) * 100) : 0,
      },
      byPlatform: {},
      byDifficulty: {},
      byPlatformDifficulty: {},
    };

    const totalsMap = new Map();
    totalByPlatformDifficulty.forEach((item) => {
      const key = `${item._id.platform}:${item._id.difficulty}`;
      totalsMap.set(key, item.count);
    });

    const solvedMap = new Map();
    solvedByPlatformDifficulty.forEach((item) => {
      const key = `${item._id.platform}:${item._id.difficulty}`;
      solvedMap.set(key, item.count);
    });

    const platforms = new Set();
    const difficulties = new Set();

    totalByPlatformDifficulty.forEach((item) => {
      platforms.add(item._id.platform);
      difficulties.add(item._id.difficulty);
    });

    solvedByPlatformDifficulty.forEach((item) => {
      platforms.add(item._id.platform);
      difficulties.add(item._id.difficulty);
    });

    for (const platform of platforms) {
      let platformTotal = 0;
      let platformSolved = 0;

      for (const difficulty of difficulties) {
        const key = `${platform}:${difficulty}`;
        const total = totalsMap.get(key) || 0;
        const solved = solvedMap.get(key) || 0;
        platformTotal += total;
        platformSolved += solved;
      }

      progress.byPlatform[platform] = {
        total: platformTotal,
        solved: platformSolved,
        percentage: platformTotal > 0 ? Math.round((platformSolved / platformTotal) * 100) : 0,
      };
    }

    for (const difficulty of difficulties) {
      let diffTotal = 0;
      let diffSolved = 0;

      for (const platform of platforms) {
        const key = `${platform}:${difficulty}`;
        const total = totalsMap.get(key) || 0;
        const solved = solvedMap.get(key) || 0;
        diffTotal += total;
        diffSolved += solved;
      }

      progress.byDifficulty[difficulty] = {
        total: diffTotal,
        solved: diffSolved,
        percentage: diffTotal > 0 ? Math.round((diffSolved / diffTotal) * 100) : 0,
      };
    }

    for (const platform of platforms) {
      progress.byPlatformDifficulty[platform] = {};
      for (const difficulty of difficulties) {
        const key = `${platform}:${difficulty}`;
        const total = totalsMap.get(key) || 0;
        const solved = solvedMap.get(key) || 0;
        progress.byPlatformDifficulty[platform][difficulty] = {
          total,
          solved,
          percentage: total > 0 ? Math.round((solved / total) * 100) : 0,
        };
      }
    }

    return progress;
  }
}

module.exports = new ProgressCalculator();
