const axios = require("axios");
const BaseContestAdapter = require("./contests-baseAdapter");

const CODEFORCES_BASE_URL = "https://codeforces.com";

/**
 * Codeforces platform adapter
 * API Documentation: https://codeforces.com/apiHelp
 */
class CodeforcesAdapter extends BaseContestAdapter {
  constructor() {
    super("Codeforces");
    this.apiUrl = "https://codeforces.com/api/contest.list";
  }

  /**
   * Fetch contests from Codeforces API
   * @returns {Promise<Array>} Array of normalized contest objects
   */
  async fetchContests() {
    try {
      this.log("Fetching contests from Codeforces API...");
      
      const response = await axios.get(this.apiUrl, {
        params: {
          gym: false, // Exclude gym contests
        },
        timeout: 10000,
      });

      if (response.data.status !== "OK") {
        throw new Error(`API returned status: ${response.data.status}`);
      }

      const contests = response.data.result;
      this.log(`Fetched ${contests.length} contests from Codeforces`);

      // Filter and normalize only upcoming and running contests
      const normalizedContests = contests
        .filter((contest) => {
          const phase = contest.phase;
          return phase === "BEFORE" || phase === "CODING" || phase === "FINISHED";
        })
        .slice(0, 20) // Limit to 20 most recent contests
        .map((contest) => this.normalizeContest(contest));

      return normalizedContests;
    } catch (error) {
      this.handleError(error, "fetching Codeforces contests");
      return [];
    }
  }

  /**
   * Normalize Codeforces contest data to our schema
   * @param {Object} contest - Raw Codeforces contest object
   * @returns {Object} Normalized contest object
   */
  normalizeContest(contest) {
    // Codeforces startTimeSeconds is in Unix timestamp format
    const startTime = new Date(contest.startTimeSeconds * 1000);
    const durationSeconds = contest.durationSeconds;

    // Determine status based on phase and time
    let status;
    switch (contest.phase) {
      case "BEFORE":
        status = "upcoming";
        break;
      case "CODING":
        status = "running";
        break;
      case "FINISHED":
      case "SYSTEM_TEST":
      case "PENDING_SYSTEM_TEST":
        status = "finished";
        break;
      default:
        status = this.getContestStatus(startTime, durationSeconds);
    }

    return {
      title: contest.name,
      platform: "codeforces",
      contestIdOnPlatform: contest.id.toString(),
      url: `${CODEFORCES_BASE_URL}/contest/${contest.id}`,
      joinUrl: `${CODEFORCES_BASE_URL}/contestRegistration/${contest.id}`,
      startTime: startTime,
      duration: Math.floor(durationSeconds / 60),
      status: status,
      numberOfProblems: 0,
      registeredCount: 0,
      participantsCount: 0,
      lastSyncedAt: new Date(),
    };
  }

  /**
   * Fetch detailed contest information (if needed)
   * @param {String} contestId - Contest ID
   * @returns {Promise<Object>} Detailed contest info
   */
  async fetchContestDetails(contestId) {
    try {
      const response = await axios.get(
        `https://codeforces.com/api/contest.standings`,
        {
          params: {
            contestId: contestId,
            from: 1,
            count: 1, // We just need the metadata, not the standings
          },
          timeout: 10000,
        }
      );

      if (response.data.status === "OK") {
        const contest = response.data.result.contest;
        return {
          numberOfProblems: response.data.result.problems?.length || 0,
        };
      }
    } catch (error) {
      this.log(
        `Failed to fetch details for contest ${contestId}: ${error.message}`,
        "warn"
      );
    }
    return null;
  }
}

module.exports = CodeforcesAdapter;
