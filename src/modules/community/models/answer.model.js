const mongoose = require("mongoose");

const answerSchema = new mongoose.Schema(
    {
        question: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Question",
            required: true,
        },
        author: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        body: {
            type: String,
            required: true,
        },
        isPinned: {
            type: Boolean,
            default: false,
        },
        isAccepted: {
            type: Boolean,
            default: false,
        },
        isFromAI: {
            type: Boolean,
            default: false,
        },
        votesCount: {
            type: Number,
            default: 0,
        },
        createdAt: {
            type: Date,
            default: Date.now,
        },
        updatedAt: {
            type: Date,
            default: Date.now,
        }
    },
    {
        timestamps: true,
    }
);

answerSchema.index({ question: 1, createdAt: -1 });
answerSchema.index({ question: 1, votesCount: -1 });
answerSchema.index({ question: 1, isAccepted: -1 });

answerSchema.index({ author: 1 });

module.exports = mongoose.model("Answer", answerSchema);
