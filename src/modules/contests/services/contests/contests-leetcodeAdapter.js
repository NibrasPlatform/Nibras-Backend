const axios = require("axios");
const BaseContestAdapter = require("./contests-baseAdapter");

/**
 * LeetCode platform adapter
 * Uses LeetCode's GraphQL API
 */
class LeetCodeAdapter extends BaseContestAdapter {
  constructor() {
    super("LeetCode");
    this.graphqlUrl = "https://leetcode.com/graphql";
  }

  /**
   * Fetch contests from LeetCode GraphQL API
   * @returns {Promise<Array>} Array of normalized contest objects
   */
  async fetchContests() {
    try {
      this.log("Fetching contests from LeetCode API...");

      const query = `
        query GetContestList {
          allContests {
            title
            titleSlug
            startTime
            duration
            originStartTime
            isVirtual
            cardImg
          }
        }
      `;

      const response = await axios.post(
        this.graphqlUrl,
        {
          query: query,
          variables: {},
        },
        {
          timeout: 10000,
          headers: {
            "Content-Type": "application/json",
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          },
        }
      );

      if (!response.data || !response.data.data) {
        throw new Error("Invalid response from LeetCode API");
      }

      const contests = response.data.data.allContests || [];
      this.log(`Fetched ${contests.length} contests from LeetCode`);

      // Filter out virtual contests and normalize
      const normalizedContests = contests
        .filter((contest) => !contest.isVirtual)
        .slice(0, 20) // Limit to 20 most recent contests
        .map((contest) => this.normalizeContest(contest));

      return normalizedContests;
    } catch (error) {
      this.handleError(error, "fetching LeetCode contests");
      return [];
    }
  }

  /**
   * Normalize LeetCode contest data to our schema
   * @param {Object} contest - Raw LeetCode contest object
   * @returns {Object} Normalized contest object
   */
  normalizeContest(contest) {
    // LeetCode startTime is in Unix timestamp format (seconds)
    const startTime = new Date(contest.startTime * 1000);
    const durationSeconds = contest.duration;

    // Determine status based on time
    const status = this.getContestStatus(startTime, durationSeconds);

    return {
      title: contest.title,
      platform: "leetcode",
      contestIdOnPlatform: contest.titleSlug,
      url: `https://leetcode.com/contest/${contest.titleSlug}`,
      startTime: startTime,
      duration: Math.floor(durationSeconds / 60), // Convert to minutes
      status: status,
      numberOfProblems: 0, // Not available in main list
      registeredCount: 0, // Not available in public API
      participantsCount: 0, // Not available in public API
      lastSyncedAt: new Date(),
    };
  }

  /**
   * Fetch detailed contest information using alternative query
   * @param {String} titleSlug - Contest slug
   * @returns {Promise<Object>} Detailed contest info
   */
  async fetchContestDetails(titleSlug) {
    try {
      const query = `
        query GetContestDetail($titleSlug: String!) {
          contest(titleSlug: $titleSlug) {
            title
            titleSlug
            description
            startTime
            duration
            originStartTime
            questions {
              title
              titleSlug
            }
            registered
            isVirtual
          }
        }
      `;

      const response = await axios.post(
        this.graphqlUrl,
        {
          query: query,
          variables: { titleSlug: titleSlug },
        },
        {
          timeout: 10000,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (response.data && response.data.data && response.data.data.contest) {
        const contest = response.data.data.contest;
        return {
          numberOfProblems: contest.questions?.length || 0,
          registeredCount: contest.registered ? 1 : 0, // Boolean field
        };
      }
    } catch (error) {
      this.log(
        `Failed to fetch details for contest ${titleSlug}: ${error.message}`,
        "warn"
      );
    }
    return null;
  }
}

module.exports = LeetCodeAdapter;
