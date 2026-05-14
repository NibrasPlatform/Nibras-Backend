let httpStatus = require("http-status");
if (httpStatus.default) httpStatus = httpStatus.default;

const catchAsync = require("../../../core/utils/catchAsync");
const Submission = require("../models/submission.model");
const Course = require("../models/course.model");
const progressService = require("../services/progress.service");
const activityEventService = require("../../gamification/services/activityEvent.service");

const submitAssignment = catchAsync(async (req, res) => {
  const userId = req.user.id || req.user._id;
  const { courseId, assignmentId, githubLink } = req.body;

  if (!courseId || !assignmentId || !githubLink) {
    return res.status(httpStatus.BAD_REQUEST).json({
      success: false,
      message: "courseId, assignmentId, and githubLink are required.",
    });
  }

  const course = await Course.findById(courseId).select("assignments");
  if (!course) {
    return res.status(httpStatus.NOT_FOUND).json({
      success: false,
      message: "Course not found",
    });
  }

  const hasAssignment = (course.assignments || []).some(
    (a) => a.assignmentId.toString() === assignmentId.toString()
  );
  if (!hasAssignment) {
    return res.status(httpStatus.BAD_REQUEST).json({
      success: false,
      message: "Assignment does not belong to the selected course.",
    });
  }

  const submission = await Submission.findOneAndUpdate(
    { userId, courseId, assignmentId },
    { $set: { githubLink, status: "pending" } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  await activityEventService.recordAssignmentSubmitted({
    userId,
    courseId,
    assignmentId,
    submissionId: submission._id,
    occurredAt: submission.updatedAt || new Date(),
  });

  return res.status(httpStatus.OK).json({
    success: true,
    message: "Assignment submitted successfully.",
    data: submission,
  });
});

const updateSubmissionStatus = catchAsync(async (req, res) => {
  const { submissionId } = req.params;
  const { status, grade } = req.body;

  if (!["pending", "approved", "needs_changes"].includes(status)) {
    return res.status(httpStatus.BAD_REQUEST).json({
      success: false,
      message: "Invalid status value.",
    });
  }

  const submission = await Submission.findById(submissionId);
  if (!submission) {
    return res.status(httpStatus.NOT_FOUND).json({
      success: false,
      message: "Submission not found.",
    });
  }

  submission.status = status;
  if (typeof grade === "number") {
    submission.grade = grade;
  }
  await submission.save();

  if (status === "approved") {
    await progressService.applyAssignmentApprovalBoost(submission.userId, submission.courseId);
    await activityEventService.recordAssignmentApproved({
      userId: submission.userId,
      courseId: submission.courseId,
      assignmentId: submission.assignmentId,
      submissionId: submission._id,
      occurredAt: submission.updatedAt || new Date(),
    });
    await activityEventService.recordHighGrade({
      userId: submission.userId,
      courseId: submission.courseId,
      assignmentId: submission.assignmentId,
      submissionId: submission._id,
      grade: submission.grade,
      occurredAt: submission.updatedAt || new Date(),
    });

    await progressService.applyAssignmentApprovalBoost(submission.userId, submission.courseId, {
      occurredAt: submission.updatedAt || new Date(),
    });
  }

  return res.status(httpStatus.OK).json({
    success: true,
    message: "Submission status updated.",
    data: submission,
  });
});

module.exports = {
  submitAssignment,
  updateSubmissionStatus,
};
