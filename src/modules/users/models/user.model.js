const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      match: [/^[a-zA-Z0-9._%+-]+@gmail\.com$/i, "Email must be a valid @gmail.com address."],
    },
    password: {
      type: String,
      required: function () {
        return this.authProvider === "manual";
      },
      minlength: 6,
      select: false,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    authProvider: {
      type: String,
      enum: ["google", "manual"],
      required: true,
    },
    role: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Role",
    },
    enrolledCourses: [
      {
        course: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Course",
          required: true,
        },
        enrolledAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    reputationScore: {
      type: Number,
      default: 0,
    },
    contestRating: {
      type: Number,
      default: 0,
    },
    problemsSolved: {
      type: Number,
      default: 0,
    },
    studyStreak: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

userSchema.pre("save", async function () {
  if (!this.isModified("password")) {
    return;
  }

  if (!this.password || /^\$2[aby]\$/.test(this.password)) {
    return;
  }

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

userSchema.methods.comparePassword = function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.models.User || mongoose.model("User", userSchema);