const mongoose = require("mongoose");

const tagSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            maxlength: 50,
        },
        description: {
            type: String,
            default: "",
            maxlength: 200,
        },
        usageCount: {
            type: Number,
            default: 0,
        },
    },
    {
        timestamps: true,
    }
);

tagSchema.index({ usageCount: -1 });
tagSchema.index({ name: "text", description: "text" }, { weights: { name: 10, description: 5 } });

module.exports = mongoose.model("Tag", tagSchema);
