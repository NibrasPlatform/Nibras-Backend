const axios = require("axios");
const AppError = require("../../../core/utils/errorHandler");
const status = require("../../../core/constants/httpStatus");
const logger = require("../../../core/utils/logger");

class LeetCodeService {
  constructor() {
    this.graphqlEndpoint = "https://leetcode.com/graphql";
    this.defaultTimeoutMs = parseInt(process.env.LEETCODE_TIMEOUT_MS || "5000", 10);
    this.defaultRetries = parseInt(process.env.LEETCODE_RETRIES || "2", 10);
    this.defaultRetryDelayMs = parseInt(process.env.LEETCODE_RETRY_DELAY_MS || "500", 10);
  }

  async fetchCompetitiveProfile(username) {
    const normalizedUsername = username.toLowerCase();

    const userBase = await this.runQueryWithRetry(
      `
        query getUser($username: String!) {
          matchedUser(username: $username) {
            username
            profile {
              ranking
              userAvatar
              aboutMe
            }
            submitStatsGlobal {
              acSubmissionNum {
                difficulty
                count
              }
            }
          }
        }
      `,
      { username: normalizedUsername },
    );

    let contestRanking = null;
    let contestHistory = null;

    try {
      contestRanking = await this.runQueryWithRetry(
        `
          query userContestRankingInfo($username: String!) {
            userContestRanking(userSlug: $username) {
              rating
              attendedContestsCount
              topPercentage
            }
          }
        `,
        { username: normalizedUsername },
      );
    } catch (error) {
      logger.warn("LeetCode contest ranking query failed", {
        username: normalizedUsername,
        error: error.message,
      });
    }

    try {
      contestHistory = await this.runQueryWithRetry(
        `
          query userContestRankingHistory($username: String!) {
            userContestRankingHistory(userSlug: $username) {
              attended
              rating
              ranking
              finishTimeInSeconds
              contest {
                title
                startTime
              }
            }
          }
        `,
        { username: normalizedUsername },
      );
    } catch (error) {
      logger.warn("LeetCode contest history query failed", {
        username: normalizedUsername,
        error: error.message,
      });
    }

    const matchedUser = userBase.matchedUser;
    if (!matchedUser) {
      throw AppError.create("LeetCode account was not found", 404, status.Fail, {
        errorCode: "PLATFORM_ACCOUNT_NOT_FOUND",
      });
    }

    const normalizedStats = this.normalizeSolveStats(matchedUser.submitStatsGlobal?.acSubmissionNum || []);
    let solvedProblemRefs = [];

    try {
      solvedProblemRefs = await this.fetchSolvedProblemRefs(normalizedUsername);
    } catch (error) {
      logger.warn("LeetCode solved problems query failed", {
        username: normalizedUsername,
        error: error.message,
      });
    }

    const ranking = contestRanking?.userContestRanking || {};
    const historyRows = contestHistory?.userContestRankingHistory || [];
    const attendedRows = historyRows.filter((item) => item.attended);
    const contestHistoryNormalized = attendedRows.map((item) => ({
      contestId: item.contest?.title || null,
      contestName: item.contest?.title || null,
      rank: item.ranking || null,
      oldRating: null,
      newRating: item.rating ?? null,
      ratingChange: null,
      date: item.contest?.startTime ? new Date(item.contest.startTime * 1000) : null,
    }));
    console.log("LeetCode contest history normalized:", contestHistoryNormalized);
    return {
      profileUrl: `https://leetcode.com/u/${normalizedUsername}/`,
      rating: ranking.rating ?? null,
      maxRating: null,
      solvedCount: normalizedStats.solvedCount,
      solvedBreakdown: {
        easy: normalizedStats.easy,
        medium: normalizedStats.medium,
        hard: normalizedStats.hard,
      },
      contestParticipationCount: ranking.attendedContestsCount || contestHistoryNormalized.length,
      contestHistory: contestHistoryNormalized,
      submissionsSummary: {
        total: normalizedStats.solvedCount,
        accepted: normalizedStats.solvedCount,
        wrongAnswer: 0,
        verdictCounts: {},
      },
      solvedProblemRefs,
      lastFetchedAt: new Date(),
      aboutMe: matchedUser.profile?.aboutMe || "",
    };
  }

  async fetchSolvedProblemRefs(username) {
    const solvedRefsBySlug = new Map();
    const limit = 50;
    let skip = 0;
    let totalNum = null;
    const maxProblems = 100; // Limit to last 100 solved problems

    while (totalNum === null || skip < totalNum) {
      // Stop if we've already collected 100 problems
      if (solvedRefsBySlug.size >= maxProblems) {
        break;
      }

      const data = await this.runQueryWithRetry(
        `
          query solvedQuestions($username: String!, $skip: Int!, $limit: Int!) {
            matchedUser(username: $username) {
              userProfileQuestions(
                questionStatus: AC
                skip: $skip
                limit: $limit
                sortBy: LAST_SUBMITTED_AT
                sortOrder: DESC
              ) {
                totalNum
                questions {
                  title
                  titleSlug
                }
              }
            }
          }
        `,
        { username, skip, limit },
      );

      const page = data?.matchedUser?.userProfileQuestions;
      if (!page) {
        break;
      }

      totalNum = Number.isFinite(Number(page.totalNum)) ? Number(page.totalNum) : 0;
      const questions = Array.isArray(page.questions) ? page.questions : [];

      for (const question of questions) {
        if (!question?.titleSlug) {
          continue;
        }

        const slug = String(question.titleSlug).trim().toLowerCase();
        if (!slug || solvedRefsBySlug.has(slug)) {
          continue;
        }

        solvedRefsBySlug.set(slug, {
          titleSlug: slug,
          title: question.title || null,
          url: `https://leetcode.com/problems/${slug}/`,
        });

        // Stop if we've collected 100 problems
        if (solvedRefsBySlug.size >= maxProblems) {
          break;
        }
      }

      if (questions.length === 0) {
        break;
      }

      skip += questions.length;
      if (solvedRefsBySlug.size >= maxProblems) {
        break;
      }
    }

    // Return only the first 100
    return [...solvedRefsBySlug.values()].slice(0, maxProblems);
  }

  async verifyBioToken(username, token) {
    const data = await this.runQueryWithRetry(
      `
        query getUser($username: String!) {
          matchedUser(username: $username) {
            profile {
              aboutMe
            }
          }
        }
      `,
      { username: username.toLowerCase() },
    );

    const aboutMe = data.matchedUser?.profile?.aboutMe || "";
    return {
      verified: aboutMe.includes(token),
      evidence: {
        field: "aboutMe",
      },
    };
  }

  normalizeSyncData(profile) {
    const easyValue = profile?.solvedBreakdown?.easy ?? profile?.easy;
    const mediumValue = profile?.solvedBreakdown?.medium ?? profile?.medium;
    const hardValue = profile?.solvedBreakdown?.hard ?? profile?.hard;
    const solvedValue = profile?.solvedCount;
    const contestHistory = this.normalizeContestHistory(
      Array.isArray(profile?.contestHistory) ? profile.contestHistory : [],
    );
    const contestParticipationCountValue = profile?.contestParticipationCount;
    const profileUrlValue = typeof profile?.profileUrl === "string" ? profile.profileUrl : "";
    const contestParticipationCountNumber = (
      contestParticipationCountValue === null
      || contestParticipationCountValue === undefined
      || contestParticipationCountValue === ""
    )
      ? Number.NaN
      : Number(contestParticipationCountValue);

    return {
      rating: profile?.rating ?? null,
      solvedCount: Number.isFinite(solvedValue)
        ? solvedValue
        : (Number.isFinite(easyValue) ? easyValue : 0)
          + (Number.isFinite(mediumValue) ? mediumValue : 0)
          + (Number.isFinite(hardValue) ? hardValue : 0),
      easy: Number.isFinite(easyValue) ? easyValue : 0,
      medium: Number.isFinite(mediumValue) ? mediumValue : 0,
      hard: Number.isFinite(hardValue) ? hardValue : 0,
      contestParticipationCount: Number.isFinite(contestParticipationCountValue)
        ? contestParticipationCountValue
        : Number.isFinite(contestParticipationCountNumber)
          ? contestParticipationCountNumber
        : contestHistory.length,
      contestHistory,
      profileUrl: profileUrlValue,
    };
  }

  normalizeContestHistory(rows) {
    return rows.map((row) => ({
      contestId: typeof row?.contestId === "string"
        ? row.contestId
        : (typeof row?.contest?.title === "string" ? row.contest.title : null),
      contestName: typeof row?.contestName === "string"
        ? row.contestName
        : (typeof row?.contest?.title === "string" ? row.contest.title : null),
      rank: this.toFiniteNumberOrNull(row?.rank ?? row?.ranking),
      oldRating: this.toFiniteNumberOrNull(row?.oldRating),
      newRating: this.toFiniteNumberOrNull(row?.newRating ?? row?.rating),
      ratingChange: this.toFiniteNumberOrNull(row?.ratingChange),
      date: this.toDateOrNull(
        row?.date ?? (row?.contest?.startTime ? row.contest.startTime * 1000 : null),
      ),
    }));
  }

  toFiniteNumberOrNull(value) {
    if (value === null || value === undefined || value === "") {
      return null;
    }
    const parsedValue = Number(value);
    return Number.isFinite(parsedValue) ? parsedValue : null;
  }

  toDateOrNull(value) {
    if (!value) {
      return null;
    }

    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
      return null;
    }
    return date;
  }

  normalizeSolveStats(rows) {
    const result = {
      solvedCount: 0,
      easy: 0,
      medium: 0,
      hard: 0,
    };
    for (const row of rows) {
      const difficulty = (row.difficulty || "").toLowerCase();
      const count = Number.parseInt(row.count, 10);
      const safeCount = Number.isNaN(count) ? 0 : count;
      if (difficulty === "all") result.solvedCount = safeCount;
      if (difficulty === "easy") result.easy = safeCount;
      if (difficulty === "medium") result.medium = safeCount;
      if (difficulty === "hard") result.hard = safeCount;
    }
    return result;
  }

  async runQueryWithRetry(query, variables, options = {}) {
    const retries = options.retries ?? this.defaultRetries;
    const retryDelayMs = options.retryDelayMs ?? this.defaultRetryDelayMs;

    let lastError = null;
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      try {
        return await this.runQueryWithTimeout(query, variables, options.timeoutMs);
      } catch (error) {
        lastError = error;
        if (attempt >= retries) {
          break;
        }
        await this.sleep(retryDelayMs);
      }
    }

    throw lastError;
  }

  async runQueryWithTimeout(query, variables, timeoutMs = this.defaultTimeoutMs) {
    const timeoutMessage = "LeetCode request timeout";
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
    });

    try {
      const response = await Promise.race([
        axios.post(
          this.graphqlEndpoint,
          { query, variables },
          {
            timeout: timeoutMs,
            headers: {
              "Content-Type": "application/json",
              "User-Agent": "Mozilla/5.0",
            },
          },
        ),
        timeoutPromise,
      ]);
      if (response.data.errors && response.data.errors.length > 0) {
        throw new Error(response.data.errors[0].message);
      }
      if (!response.data.data) {
        throw new Error("Missing data in response");
      }
      console.log("LeetCode API response data:", response.data.data);
      return response.data.data;
    } catch (error) {
      console.log("LeetCode error:", error.message);
      console.log("LeetCode response:", error.response?.data);

      const errorCode = error.message === timeoutMessage
        ? "LEETCODE_TIMEOUT"
        : (error.response?.status === 400 ? "LEETCODE_BAD_REQUEST" : "PLATFORM_UNAVAILABLE");
      throw AppError.create(`LeetCode API call failed: ${error.message}`, 502, status.Fail, {
        errorCode,
      });
    }
  }

  async sleep(ms) {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }
}

module.exports = new LeetCodeService();
