const axios = require("axios");
const AppError = require("../../../core/utils/errorHandler");
const status = require("../../../core/constants/httpStatus");
const Problem = require("../models/problem.model");

const codeforcesProblemUrlPatterns = [
  /^\/problemset\/problem\/(\d+)\/([a-z0-9]+)$/i,
  /^\/contest\/(\d+)\/problem\/([a-z0-9]+)$/i,
];

const getDifficultyFromRating = (rating) => {
  if (rating >= 1601) return "advanced";
  if (rating >= 1301) return "intermediate";
  if (rating >= 1001) return "newbie";
  if (rating >= 800) return "beginner";
  return null;
};

class ProblemMetadataService {
  constructor() {
    this.codeforcesProblemsetApi = "https://codeforces.com/api/problemset.problems";
    this.cachedCodeforcesProblems = null;
    this.cacheFetchedAt = 0;
    this.cacheTtlMs = 5 * 60 * 1000;
  }

  async fetchFromUrl(url) {
    const platform = Problem.detectPlatformFromUrl(url);

    if (!platform) {
      throw AppError.create(
        "Unsupported problem URL domain",
        400,
        status.Fail,
        { errorCode: "UNSUPPORTED_PROBLEM_URL" }
      );
    }

    if (platform !== "codeforces") {
      throw AppError.create(
        "Automatic problem metadata extraction currently supports only Codeforces URLs",
        400,
        status.Fail,
        { errorCode: "PROBLEM_METADATA_UNSUPPORTED_PLATFORM" }
      );
    }

    return this.fetchCodeforcesMetadata(url);
  }

  parseCodeforcesUrl(url) {
    let parsedUrl;

    try {
      parsedUrl = new URL(url);
    } catch (error) {
      throw AppError.create(
        "Invalid problem URL",
        400,
        status.Fail,
        { errorCode: "INVALID_PROBLEM_URL" }
      );
    }

    const pathname = parsedUrl.pathname.replace(/\/+$/, "");
    const match = codeforcesProblemUrlPatterns
      .map((pattern) => pathname.match(pattern))
      .find(Boolean);

    if (!match) {
      throw AppError.create(
        "Unsupported Codeforces problem URL format",
        400,
        status.Fail,
        { errorCode: "UNSUPPORTED_PROBLEM_URL_FORMAT" }
      );
    }

    return {
      contestId: Number.parseInt(match[1], 10),
      index: String(match[2]).toUpperCase(),
    };
  }

  async getCodeforcesProblems() {
    const isCacheValid = this.cachedCodeforcesProblems
      && Date.now() - this.cacheFetchedAt < this.cacheTtlMs;

    if (isCacheValid) {
      return this.cachedCodeforcesProblems;
    }

    try {
      const response = await axios.get(this.codeforcesProblemsetApi, {
        timeout: 15000,
      });

      if (!response.data || response.data.status !== "OK") {
        throw new Error(response.data?.comment || "Unexpected Codeforces API response");
      }

      this.cachedCodeforcesProblems = response.data.result?.problems || [];
      this.cacheFetchedAt = Date.now();

      return this.cachedCodeforcesProblems;
    } catch (error) {
      throw AppError.create(
        `Failed to fetch Codeforces problem metadata: ${error.message}`,
        502,
        status.Fail,
        { errorCode: "PROBLEM_METADATA_FETCH_FAILED" }
      );
    }
  }

  async fetchCodeforcesMetadata(url) {
    const { contestId, index } = this.parseCodeforcesUrl(url);
    const problems = await this.getCodeforcesProblems();
    
    const matchedProblem = problems.find(
      (problem) => problem.contestId === contestId && String(problem.index).toUpperCase() === index
    );
    
    if (!matchedProblem) {
      throw AppError.create(
        "Problem not found on Codeforces",
        404,
        status.Fail,
        { errorCode: "PROBLEM_NOT_FOUND_ON_PLATFORM" }
      );
    }

    const rating = Number(matchedProblem.rating);
    if (!Number.isFinite(rating)) {
      throw AppError.create(
        "Problem rating is missing on Codeforces; difficulty cannot be derived",
        400,
        status.Fail,
        { errorCode: "PROBLEM_RATING_UNAVAILABLE" }
      );
    }

    const difficulty = getDifficultyFromRating(rating);
    if (!difficulty) {
      throw AppError.create(
        "Problem rating must be at least 800 to derive difficulty",
        400,
        status.Fail,
        { errorCode: "PROBLEM_RATING_OUT_OF_RANGE" }
      );
    }

    return {
      title: matchedProblem.name,
      platform: "codeforces",
      rating,
      difficulty,
      tags: Array.isArray(matchedProblem.tags) ? matchedProblem.tags : [],
    };
  }
}

module.exports = new ProblemMetadataService();
