const axios = require("axios");
const BaseContestAdapter = require("./contests-baseAdapter");

class HackerRankAdapter extends BaseContestAdapter {
  constructor() {
    super("HackerRank");
    this.baseUrl = "https://www.hackerrank.com";
  }

  async fetchContests() {
    try {
      this.log("Fetching contests from HackerRank API...");
      const [upcoming, past] = await Promise.all([
        this.fetchByPath("/rest/contests/upcoming?offset=0&limit=20"),
        this.fetchByPath("/rest/contests/past?offset=0&limit=20"),
      ]);

      const combined = [
        ...upcoming.map((contest) => this.normalizeContest(contest)),
        ...past.map((contest) => this.normalizeContest(contest, "finished")),
      ];

      const unique = [];
      const ids = new Set();
      for (const contest of combined) {
        if (!contest.contestIdOnPlatform || ids.has(contest.contestIdOnPlatform)) {
          continue;
        }
        ids.add(contest.contestIdOnPlatform);
        unique.push(contest);
      }

      this.log(`Fetched ${unique.length} contests from HackerRank`);
      return unique;
    } catch (error) {
      this.handleError(error, "fetching HackerRank contests");
      return [];
    }
  }

  async fetchByPath(path) {
    const response = await axios.get(`${this.baseUrl}${path}`, {
      timeout: 15000,
      headers: {
        "User-Agent": "Mozilla/5.0",
        Accept: "application/json",
      },
    });
    const payload = response.data;
    if (Array.isArray(payload)) {
      return payload;
    }
    if (Array.isArray(payload?.models)) {
      return payload.models;
    }
    if (Array.isArray(payload?.contests)) {
      return payload.contests;
    }
    return [];
  }

  normalizeContest(contest, defaultStatus = null) {
    const startSeconds = this.resolveStartSeconds(contest);
    const durationSeconds = this.resolveDurationSeconds(contest);
    const startTime = new Date(startSeconds * 1000);
    const status = defaultStatus || this.getContestStatus(startTime, durationSeconds);
    const contestSlug = contest.slug || contest.contest_slug || contest.name || String(contest.id || "");
    const contestId = String(contest.id || contestSlug);

    return {
      title: contest.name || contest.title || contestSlug,
      platform: "hackerrank",
      contestIdOnPlatform: contestId,
      url: `${this.baseUrl}/contests/${contestSlug}`,
      startTime,
      duration: Math.floor(durationSeconds / 60),
      status,
      numberOfProblems: Number.parseInt(contest.number_of_challenges || contest.challenges_count || 0, 10) || 0,
      registeredCount: Number.parseInt(contest.registered_users || 0, 10) || 0,
      participantsCount: Number.parseInt(contest.participants || 0, 10) || 0,
      lastSyncedAt: new Date(),
    };
  }

  resolveStartSeconds(contest) {
    const direct =
      contest.start_time_epoch ||
      contest.starttime ||
      contest.start_time ||
      contest.startTime ||
      contest.epoch_starttime;
    const parsed = Number.parseInt(direct, 10);
    if (!Number.isNaN(parsed) && parsed > 0) {
      return parsed;
    }
    const dateParsed = new Date(contest.start_date || contest.startTime || Date.now());
    return Math.floor(dateParsed.getTime() / 1000);
  }

  resolveDurationSeconds(contest) {
    const duration =
      contest.duration_seconds ||
      contest.duration ||
      contest.contest_duration ||
      contest.duration_secs;
    const parsedDuration = Number.parseInt(duration, 10);
    if (!Number.isNaN(parsedDuration) && parsedDuration > 0) {
      return parsedDuration;
    }

    const end =
      contest.end_time_epoch ||
      contest.endtime ||
      contest.end_time ||
      contest.endTime ||
      contest.epoch_endtime;
    const parsedEnd = Number.parseInt(end, 10);
    const parsedStart = this.resolveStartSeconds(contest);
    if (!Number.isNaN(parsedEnd) && parsedEnd > parsedStart) {
      return parsedEnd - parsedStart;
    }

    return 0;
  }
}

module.exports = HackerRankAdapter;
