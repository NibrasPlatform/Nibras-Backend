const axios = require("axios");
const cheerio = require("cheerio");
const AppError = require("../../../core/utils/errorHandler");
const status = require("../../../core/constants/httpStatus");

class CodeforcesService {
  constructor() {
    this.apiBaseUrl = "https://codeforces.com/api";
  }

  async fetchCompetitiveProfile(handle) {
    const normalizedHandle = handle.toLowerCase();
    const [userInfo, submissions, ratingHistory] = await Promise.all([
      this.callApi("/user.info", { handles: normalizedHandle }),
      this.callApi("/user.status", { handle: normalizedHandle, from: 1, count: 1000 }),
      this.callApi("/user.rating", { handle: normalizedHandle }),
    ]);

    const profile = userInfo[0];
    if (!profile) {
      throw AppError.create("Codeforces account was not found", 404, status.Fail, {
        errorCode: "PLATFORM_ACCOUNT_NOT_FOUND",
      });
    }

    const solvedSet = new Set();
    const verdictCounts = {};
    for (const submission of submissions) {
      const verdict = submission.verdict || "UNKNOWN";
      verdictCounts[verdict] = (verdictCounts[verdict] || 0) + 1;
      if (verdict === "OK" && submission.problem) {
        const contestKey = submission.problem.contestId || "na";
        const indexKey = submission.problem.index || "na";
        solvedSet.add(`${contestKey}:${indexKey}`);
      }
    }

    // Get last 100 solved problems only (for sync)
    const last100SolvedProblems = this.getLast100SolvedProblems(submissions);
    
    // Convert to key-value map for deduplication
    const solvedProblemRefsByKey = new Map();
    for (const problem of last100SolvedProblems) {
      const solvedKey = `${problem.contestId}:${problem.index}`;
      if (!solvedProblemRefsByKey.has(solvedKey)) {
        solvedProblemRefsByKey.set(solvedKey, problem);
      }
    }

    const contestHistory = ratingHistory.map((entry) => ({
      contestId: entry.contestId ? String(entry.contestId) : null,
      contestName: entry.contestName || null,
      rank: entry.rank || null,
      oldRating: entry.oldRating ?? null,
      newRating: entry.newRating ?? null,
      ratingChange: entry.newRating != null && entry.oldRating != null
        ? entry.newRating - entry.oldRating
        : null,
      date: entry.ratingUpdateTimeSeconds
        ? new Date(entry.ratingUpdateTimeSeconds * 1000)
        : null,
    }));

    return {
      profileUrl: `https://codeforces.com/profile/${normalizedHandle}`,
      rating: profile.rating ?? null,
      maxRating: profile.maxRating ?? null,
      rate: profile.rank || "unrated",
      maxRate: profile.maxRank || null,
      solvedCount: solvedSet.size,
      solvedBreakdown: {
        easy: null,
        medium: null,
        hard: null,
      },
      contestParticipationCount: contestHistory.length,
      contestHistory,
      submissionsSummary: {
        total: submissions.length,
        accepted: verdictCounts.OK || 0,
        wrongAnswer: verdictCounts.WRONG_ANSWER || 0,
        verdictCounts,
      },
      solvedProblemRefs: [...solvedProblemRefsByKey.values()],
      lastFetchedAt: new Date(),
    };
  }

  getLast100SolvedProblems(submissions) {
    const solved = [];
    for (const submission of submissions) {
      if (submission.verdict === "OK" && submission.problem && submission.problem.contestId && submission.problem.index) {
        const normalizedIndex = String(submission.problem.index).toUpperCase();
        solved.push({
          contestId: Number(submission.problem.contestId),
          index: normalizedIndex,
          url: `https://codeforces.com/problemset/problem/${submission.problem.contestId}/${normalizedIndex}`,
          submittedAt: submission.creationTimeSeconds ? new Date(submission.creationTimeSeconds * 1000) : null,
        });
      }
      if (solved.length >= 100) {
        break;
      }
    }
    return solved;
  }

  async verifyCompilationErrorSubmission(handle, options = {}) {
    const normalizedHandle = handle.toLowerCase();
    const startedAtMs = options.startedAt ? new Date(options.startedAt).getTime() : Date.now() - (15 * 60 * 1000);
    const expiresAtMs = options.expiresAt ? new Date(options.expiresAt).getTime() : Date.now();
    const preferredProblem = options.preferredProblem || null;

    const submissions = await this.callApi("/user.status", {
      handle: normalizedHandle,
      from: 1,
      count: 200,
    });

    const compilationErrorsInWindow = submissions.filter((submission) => {
      const createdAtMs = submission.creationTimeSeconds
        ? submission.creationTimeSeconds * 1000
        : null;
      if (!createdAtMs) return false;
      if (createdAtMs < startedAtMs || createdAtMs > expiresAtMs) return false;
      return submission.verdict === "COMPILATION_ERROR";
    });

    if (compilationErrorsInWindow.length === 0) {
      return {
        verified: false,
        evidence: null,
      };
    }

    let matchedSubmission = compilationErrorsInWindow[0];
    let matchedRule = "any_problem";
    if (preferredProblem) {
      const preferred = compilationErrorsInWindow.find(
        (submission) =>
          submission.contestId === preferredProblem.contestId
          && submission.problem?.index === preferredProblem.index,
      );
      if (preferred) {
        matchedSubmission = preferred;
        matchedRule = "preferred_problem";
      }
    }

    return {
      verified: true,
      evidence: {
        submissionId: matchedSubmission.id,
        contestId: matchedSubmission.contestId || null,
        problemIndex: matchedSubmission.problem?.index || null,
        verdict: matchedSubmission.verdict || null,
        submittedAt: matchedSubmission.creationTimeSeconds
          ? new Date(matchedSubmission.creationTimeSeconds * 1000)
          : null,
        matchedRule,
        problemUrl: matchedSubmission.contestId && matchedSubmission.problem?.index
          ? `https://codeforces.com/contest/${matchedSubmission.contestId}/problem/${matchedSubmission.problem.index}`
          : null,
      },
    };
  }

  async fetchSubmissionSource(submission) {
    const submissionId = submission.id;
    const contestId = submission.contestId;
    const urls = [];

    if (contestId) {
      urls.push(`https://codeforces.com/contest/${contestId}/submission/${submissionId}`);
      urls.push(`https://codeforces.com/problemset/submission/${contestId}/${submissionId}`);
    }

    for (const url of urls) {
      try {
        const { data } = await axios.get(url, {
          timeout: 10000,
          headers: {
            "User-Agent": "Mozilla/5.0",
          },
        });
        const $ = cheerio.load(data);
        const source = $("#program-source-text").text().trim();
        if (source) {
          return source;
        }
      } catch (error) {
        // Some submissions are not publicly viewable by URL variant; continue to next.
      }
    }

    return null;
  }

  async callApi(path, params) {
    try {
      const response = await axios.get(`${this.apiBaseUrl}${path}`, {
        params,
        timeout: 15000,
      });

      if (!response.data || response.data.status !== "OK") {
        throw new Error(response.data?.comment || "Unexpected Codeforces response");
      }

      return response.data.result;
    } catch (error) {
      throw AppError.create(`Codeforces API call failed: ${error.message}`, 502, status.Fail, {
        errorCode: "PLATFORM_UNAVAILABLE",
      });
    }
  }
}

module.exports = new CodeforcesService();
