const axios = require("axios");
const cheerio = require("cheerio");
const AppError = require("../../../core/utils/errorHandler");
const status = require("../../../core/constants/httpStatus");

class HackerRankService {
  constructor() {
    this.baseUrl = "https://www.hackerrank.com";
  }

  async fetchCompetitiveProfile(username) {
    const normalizedUsername = username.toLowerCase().trim();
    const html = await this.fetchProfilePage(normalizedUsername);
    const $ = cheerio.load(html);
    const pageText = $("body").text().replace(/\s+/g, " ").trim();

    const solvedCount = this.extractNumber([
      /"solved_challenges"\s*:\s*(\d+)/i,
      /"solvedCount"\s*:\s*(\d+)/i,
      /(\d+)\s+problems?\s+solved/i,
      /problems?\s+solved[^0-9]*(\d+)/i,
    ], html, pageText);

    const stars = this.extractNumber([
      /"stars"\s*:\s*(\d+)/i,
      /(\d+)\s+stars?/i,
    ], html, pageText);

    return {
      profileUrl: `${this.baseUrl}/profile/${normalizedUsername}`,
      rating: stars,
      maxRating: null,
      solvedCount,
      solvedBreakdown: {
        easy: null,
        medium: null,
        hard: null,
      },
      contestParticipationCount: 0,
      contestHistory: [],
      submissionsSummary: {
        total: solvedCount,
        accepted: solvedCount,
        wrongAnswer: 0,
        verdictCounts: {},
      },
      badges: this.extractBadges($, html),
      stars,
      domainScores: this.extractDomainScores(html),
      lastFetchedAt: new Date(),
    };
  }

  async verifyBioToken(username, token) {
    const html = await this.fetchProfilePage(username.toLowerCase().trim());
    const $ = cheerio.load(html);
    const bodyText = $("body").text();
    return {
      verified: bodyText.includes(token),
      evidence: {
        field: "profile_bio",
      },
    };
  }

  async fetchProfilePage(username) {
    try {
      const response = await axios.get(`${this.baseUrl}/profile/${username}`, {
        timeout: 15000,
        headers: { "User-Agent": "Mozilla/5.0" },
      });
      const html = response.data || "";
      if (!html || /page not found/i.test(html)) {
        throw AppError.create("HackerRank account was not found", 404, status.Fail, {
          errorCode: "PLATFORM_ACCOUNT_NOT_FOUND",
        });
      }
      return html;
    } catch (error) {
      if (error?.statusCode === 404 || error?.response?.status === 404) {
        throw AppError.create("HackerRank account was not found", 404, status.Fail, {
          errorCode: "PLATFORM_ACCOUNT_NOT_FOUND",
        });
      }
      if (error?.statusCode) {
        throw error;
      }
      throw AppError.create(`HackerRank profile fetch failed: ${error.message}`, 502, status.Fail, {
        errorCode: "PLATFORM_UNAVAILABLE",
      });
    }
  }

  extractNumber(regexList, ...sources) {
    for (const source of sources) {
      for (const regex of regexList) {
        const match = (source || "").match(regex);
        if (match?.[1] != null) {
          const value = Number.parseInt(match[1], 10);
          if (!Number.isNaN(value)) {
            return value;
          }
        }
      }
    }
    return 0;
  }

  extractBadges($, html) {
    const badges = new Set();
    $('[class*="badge"], [data-automation*="badge"]').each((_, element) => {
      const text = $(element).text().replace(/\s+/g, " ").trim();
      if (text && text.length <= 64) {
        badges.add(text);
      }
    });

    const scriptMatches = html.match(/"badge_name"\s*:\s*"([^"]+)"/gi) || [];
    for (const row of scriptMatches) {
      const match = row.match(/"badge_name"\s*:\s*"([^"]+)"/i);
      if (match?.[1]) {
        badges.add(match[1]);
      }
    }

    return [...badges];
  }

  extractDomainScores(html) {
    const scores = [];
    const matcher = /"domain_name"\s*:\s*"([^"]+)"[^}]*"score"\s*:\s*([0-9.]+)/gi;
    let match = matcher.exec(html);
    while (match) {
      const score = Number.parseFloat(match[2]);
      scores.push({
        domain: match[1],
        score: Number.isNaN(score) ? null : score,
      });
      match = matcher.exec(html);
    }
    return scores;
  }
}

module.exports = new HackerRankService();
