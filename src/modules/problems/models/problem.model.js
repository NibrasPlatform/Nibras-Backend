const mongoose = require("mongoose");

const PLATFORM_BY_DOMAIN = [
  { domain: "codeforces.com", platform: "codeforces" },
  { domain: "leetcode.com", platform: "leetcode" },
  { domain: "atcoder.jp", platform: "atcoder" },
];

const normalizeProblemUrl = (rawUrl) => {
  const parsed = new URL(rawUrl.trim());
  parsed.hash = "";
  parsed.searchParams.sort();

  if (parsed.pathname && parsed.pathname !== "/") {
    parsed.pathname = parsed.pathname.replace(/\/+$/, "");
  }

  return parsed.toString();
};

const detectPlatformFromUrl = (rawUrl) => {
  try {
    const parsed = new URL(rawUrl);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, "");

    const match = PLATFORM_BY_DOMAIN.find(
      ({ domain }) => host === domain || host.endsWith(`.${domain}`)
    );

    return match ? match.platform : null;
  } catch (error) {
    return null;
  }
};

const problemSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    platform: {
      type: String,
      required: true,
      lowercase: true,
      enum: ["codeforces", "leetcode", "atcoder"],
    },
    url: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    difficulty: {
      type: String,
      required: true,
      lowercase: true,
      enum: ["beginner", "newbie", "intermediate", "advanced"],
    },
    tags: {
      type: [String],
      default: [],
      set: (values) => {
        if (!Array.isArray(values)) return [];

        const normalized = values
          .map((tag) => String(tag).trim().toLowerCase())
          .filter(Boolean);

        return [...new Set(normalized)];
      },
    },
    rating: {
      type: Number,
      default: null,
    },
    isCore: {
      type: Boolean,
      default: false,
    },
    order: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
  }
);

problemSchema.pre("validate", function preValidate() {
  if (!this.url) {
    return;
  }

  this.url = normalizeProblemUrl(this.url);

  const detectedPlatform = detectPlatformFromUrl(this.url);
  if (detectedPlatform && !this.platform) {
    this.platform = detectedPlatform;
  }

  if (detectedPlatform && this.platform && this.platform !== detectedPlatform) {
    this.invalidate("platform", "Platform does not match the URL domain");
  }
});

problemSchema.index({ isCore: 1, difficulty: 1, order: 1 });
problemSchema.index({ difficulty: 1 });
problemSchema.index({ tags: 1 });

problemSchema.statics.detectPlatformFromUrl = detectPlatformFromUrl;
problemSchema.statics.normalizeProblemUrl = normalizeProblemUrl;

module.exports = mongoose.model("Problem", problemSchema);
