const PLATFORMS = {
  CODEFORCES: "codeforces",
  LEETCODE: "leetcode",
  HACKERRANK: "hackerrank",
};

const PLATFORM_LIST = Object.values(PLATFORMS);

const VERIFICATION_METHODS = {
  codeforces: "submission_token",
  leetcode: "profile_bio_token",
  hackerrank: "profile_bio_token",
};

module.exports = {
  PLATFORMS,
  PLATFORM_LIST,
  VERIFICATION_METHODS,
};
