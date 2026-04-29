const mongoose = require('mongoose');

const achievementSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true 
    },
    description: {
        type: String,
        required: true 
    },
    points: {
        type: Number,
        required: true,
        default: 0 
    },
    badgeIcon: {
        type: String 
    }
}, { timestamps: true });

module.exports = mongoose.models.Achievement || mongoose.model('Achievement', achievementSchema);