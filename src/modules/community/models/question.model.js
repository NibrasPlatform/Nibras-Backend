const mongoose = require("mongoose");

const questionSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: true,
        },
        body: {
            type: String,
            required: true,
        },
        author: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        course: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Course",
        },
        tags: {
            type: [
                {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "Tag",
                }
            ],
            default: [],
        },
        status: {
            type: String,
            enum: ["open", "closed"],
            default: "open",
        },
        votesCount: {
            type: Number,
            default: 0,
        },
        answersCount: {
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

questionSchema.index({ "tags": 1 });
questionSchema.index({ course: 1 });
questionSchema.index({ author: 1 });
questionSchema.index({ createdAt: -1 });
questionSchema.index({ title: "text", body: "text" }, { weights: { title: 10, body: 5 } });

module.exports = mongoose.model("Question", questionSchema);
