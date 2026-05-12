const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
    studentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    title: {
        type: String,
        required: true
    },
    healthStatus: {
        type: String,
        required: true
    },
    progress: {
        type: Number,
        default: 0
    },
    dueDate: {
        type: String,
        required: true
    }
}, { timestamps: true });

// Index for student project lookups
projectSchema.index({ studentId: 1 });

module.exports = mongoose.models.Project || mongoose.model('Project', projectSchema);
