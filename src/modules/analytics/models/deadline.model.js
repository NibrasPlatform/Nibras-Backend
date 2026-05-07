const mongoose = require('mongoose');

const deadlineSchema = new mongoose.Schema({
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
    dueDate: {
        type: Date,
        required: true
    }
}, { timestamps: true });

deadlineSchema.index({ studentId: 1 });

module.exports = mongoose.models.Deadline || mongoose.model('Deadline', deadlineSchema);
