let httpStatus = require("http-status");
if (httpStatus.default) httpStatus = httpStatus.default;

const catchAsync = require("../../../core/utils/catchAsync");
const assignmentService = require("../services/assignment.service");

const createAssignment = catchAsync(async (req, res) => {
  const assignment = await assignmentService.createAssignment(req.body);
  res.status(httpStatus.CREATED).json({
    success: true,
    message: "Assignment created successfully",
    data: assignment,
  });
});

const updateAssignment = catchAsync(async (req, res) => {
  const assignment = await assignmentService.getAssignmentById(req.params.assignmentId);
  const isAdmin = req.user.role.name === "Admin" || req.user.role.name === "Super Admin";
  const assignmentInstructorId = assignmentService.getAssignmentOwnerId(assignment);
  const isOwner =
    req.user.role.name === "Instructor" &&
    assignmentInstructorId === req.user._id.toString();

  if (!isAdmin && !isOwner) {
    return res.status(httpStatus.FORBIDDEN).json({
      success: false,
      message: "Access Denied: You can only update your own assignments.",
    });
  }

  const updatedAssignment = await assignmentService.updateAssignment(req.params.assignmentId, req.body);
  res.status(httpStatus.OK).json({
    success: true,
    message: "Assignment updated successfully",
    data: updatedAssignment,
  });
});

const deleteAssignment = catchAsync(async (req, res) => {
  const assignment = await assignmentService.getAssignmentById(req.params.assignmentId);
  const isAdmin = req.user.role.name === "Admin" || req.user.role.name === "Super Admin";
  const assignmentInstructorId = assignmentService.getAssignmentOwnerId(assignment);
  const isOwner =
    req.user.role.name === "Instructor" &&
    assignmentInstructorId === req.user._id.toString();

  if (!isAdmin && !isOwner) {
    return res.status(httpStatus.FORBIDDEN).json({
      success: false,
      message: "Access Denied: You can only delete your own assignments.",
    });
  }

  await assignmentService.deleteAssignment(req.params.assignmentId);
  res.status(httpStatus.OK).json({
    success: true,
    message: "Assignment deleted successfully",
  });
});

const getCourseAssignments = catchAsync(async (req, res) => {
  const { courseId } = req.params;
  const result = await assignmentService.getAssignmentsByCourse(courseId, req.query);

  res.status(httpStatus.OK).json({
    success: true,
    data: result.items,
    meta: result.meta,
  });
});

const getAssignmentById = catchAsync(async (req, res) => {
  const assignment = await assignmentService.getAssignmentById(req.params.assignmentId);
  res.status(httpStatus.OK).json({
    success: true,
    data: assignment,
  });
});

module.exports = {
  createAssignment,
  getCourseAssignments,
  getAssignmentById,
  updateAssignment,
  deleteAssignment,
};
