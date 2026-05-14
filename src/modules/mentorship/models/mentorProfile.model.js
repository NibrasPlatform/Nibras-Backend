const mongoose = require("mongoose");

const mentorProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    roleType: {
      type: String,
      enum: ["Instructor", "TA"],
      required: true,
    },
    optIn: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "disabled"],
      default: "pending",
      index: true,
    },
    availability: {
      type: String,
      enum: ["open", "limited", "paused"],
      default: "open",
      index: true,
    },
    bio: {
      type: String,
      default: null,
      trim: true,
    },
    focusTags: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Tag",
      },
    ],
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    approvedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

mentorProfileSchema.index({ status: 1, availability: 1 });
mentorProfileSchema.index({ focusTags: 1 });

module.exports = mongoose.models.MentorProfile || mongoose.model("MentorProfile", mentorProfileSchema);
