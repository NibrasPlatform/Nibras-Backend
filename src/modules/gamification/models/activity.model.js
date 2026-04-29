const mongoose = require('mongoose');

const activitySchema = new mongoose.Schema({
    studentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    title: {
        type: String,
        required: true
    },
    type: {
        type: String,
        required: true
    },
    statusTag: {
        type: String,
        required: true
    }
}, { timestamps: true });

module.exports = mongoose.models.Activity || mongoose.model('Activity', activitySchema);
