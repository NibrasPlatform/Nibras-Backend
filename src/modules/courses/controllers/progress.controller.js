let httpStatus = require("http-status");
if (httpStatus.default) httpStatus = httpStatus.default;

const catchAsync = require("../../../core/utils/catchAsync");
const progressService = require("../services/progress.service");

const getStudentProgress = catchAsync(async (req, res) => {
  const userId = req.user.id || req.user._id;
  const { courseId } = req.params;

  const progress = await progressService.getProgress(userId, courseId);

  res.status(httpStatus.OK).json({
    success: true,
    data: progress,
  });
});

const toggleSectionCompletion = catchAsync(async (req, res) => {
  const userId = req.user.id || req.user._id;
  const { courseId, sectionId } = req.params;
  const { isCompleted } = req.body;
  const { watchedAll } = req.body;

  if (typeof isCompleted !== "boolean") {
    return res.status(httpStatus.BAD_REQUEST).json({
      success: false,
      message: "isCompleted must be a boolean value.",
    });
  }

  const progress = await progressService.updateSectionStatus(
    userId,
    courseId,
    sectionId,
    isCompleted,
    { watchedAll: Boolean(watchedAll) }
  );

  res.status(httpStatus.OK).json({
    success: true,
    message: `Section marked as ${isCompleted ? "completed" : "incomplete"}.`,
    data: progress,
  });
});

const getGlobalProgress = catchAsync(async (req, res) => {
  const userId = req.user.id || req.user._id;
  const result = await progressService.getGlobalProgress(userId);

  res.status(httpStatus.OK).json({
    success: true,
    data: result,
  });
});

module.exports = {
  getStudentProgress,
  toggleSectionCompletion,
  getGlobalProgress,
};
