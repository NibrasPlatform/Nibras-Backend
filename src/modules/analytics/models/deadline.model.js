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
        type: String,
        required: true
    }
}, { timestamps: true });

module.exports = mongoose.models.Deadline || mongoose.model('Deadline', deadlineSchema);
