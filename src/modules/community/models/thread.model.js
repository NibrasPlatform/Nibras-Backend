const mongoose = require("mongoose");

const threadSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: [true, "Thread title is required"],
            trim: true,
            maxlength: [300, "Title cannot exceed 300 characters"],
        },
        body: {
            type: String,
            required: [true, "Thread body is required"],
        },
        course: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Course",
            required: [true, "Course is required"],
        },
        author: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: [true, "Author is required"],
        },
        isPinned: {
            type: Boolean,
            default: false,
        },
        status: {
            type: String,
            enum: ["open", "closed"],
            default: "open",
        },
        tags: {
            type: [
                {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "Tag",
                },
            ],
            default: [],
        },
        postsCount: {
            type: Number,
            default: 0,
        },
        votesCount: {
            type: Number,
            default: 0,
        },
    },
    {
        timestamps: true,
    }
);

threadSchema.index({ course: 1, createdAt: -1 });
threadSchema.index({ course: 1, isPinned: -1, createdAt: -1 });
threadSchema.index({ author: 1 });
threadSchema.index({ tags: 1 });
threadSchema.index(
    { title: "text", body: "text" },
    { weights: { title: 10, body: 5 } }
);

module.exports = mongoose.model("Thread", threadSchema);
