const mongoose = require("mongoose");

const postSchema = new mongoose.Schema(
    {
        body: {
            type: String,
            required: [true, "Post body is required"],
        },
        thread: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Thread",
            required: [true, "Thread is required"],
        },
        author: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: [true, "Author is required"],
        },
        votesCount: {
            type: Number,
            default: 0,
        },
        isAccepted: {
            type: Boolean,
            default: false,
        },
        isPinned: {
            type: Boolean,
            default: false,
        },
    },
    {
        timestamps: true,
    }
);

postSchema.index({ thread: 1, createdAt: -1 });
postSchema.index({ thread: 1, votesCount: -1 });
postSchema.index({ author: 1 });

module.exports = mongoose.model("Post", postSchema);
