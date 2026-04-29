const mongoose = require('mongoose');

const studentAchievementSchema = new mongoose.Schema({
    studentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    achievementId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Achievement',
        required: true
    },
    dateAwarded: {
        type: Date,
        default: Date.now
    }
});

 
studentAchievementSchema.statics.findOrCreate = function(studentId, achievementId) {
    return this.findOne({ studentId, achievementId })
        .then(existing => {
            if (existing) {
                return existing;
            }
            return this.create({ studentId, achievementId });
        });
};

module.exports = mongoose.model('StudentAchievement', studentAchievementSchema);