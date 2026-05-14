const catchAsync = require("../../../core/utils/catchAsync");
const AppError = require("../../../core/utils/errorHandler");
const mentorshipService = require("../services/mentorship.service");

const updateMyProfile = catchAsync(async (req, res) => {
  const profile = await mentorshipService.updateMyProfile(req.user, req.body);
  res.status(200).json({ success: true, message: "Mentor profile updated successfully", data: profile });
});

const getMySuggestions = catchAsync(async (req, res) => {
  const suggestions = await mentorshipService.getSuggestionsForUser(req.user._id, req.query.limit);
  res.status(200).json({ success: true, message: "Mentor suggestions fetched successfully", data: suggestions });
});

const listProfiles = catchAsync(async (req, res) => {
  const profiles = await mentorshipService.listProfiles({ status: req.query.status });
  res.status(200).json({ success: true, message: "Mentor profiles fetched successfully", data: profiles });
});

const approveProfile = catchAsync(async (req, res) => {
  const profile = await mentorshipService.setProfileStatus(req.params.userId, "approved", req.user._id);
  if (!profile) throw AppError.create("Mentor profile not found", 404, "fail");
  res.status(200).json({ success: true, message: "Mentor profile approved successfully", data: profile });
});

const rejectProfile = catchAsync(async (req, res) => {
  const profile = await mentorshipService.setProfileStatus(req.params.userId, "rejected", req.user._id);
  if (!profile) throw AppError.create("Mentor profile not found", 404, "fail");
  res.status(200).json({ success: true, message: "Mentor profile rejected successfully", data: profile });
});

const updateAvailability = catchAsync(async (req, res) => {
  const availability = String(req.body.availability || "").trim().toLowerCase();
  if (!["open", "limited", "paused"].includes(availability)) {
    throw AppError.create("availability must be open, limited, or paused", 400, "fail");
  }
  const profile = await mentorshipService.updateAvailability(req.params.userId, availability);
  if (!profile) throw AppError.create("Mentor profile not found", 404, "fail");
  res.status(200).json({ success: true, message: "Mentor availability updated successfully", data: profile });
});

module.exports = {
  approveProfile,
  getMySuggestions,
  listProfiles,
  rejectProfile,
  updateAvailability,
  updateMyProfile,
};
