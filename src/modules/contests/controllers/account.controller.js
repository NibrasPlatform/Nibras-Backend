const catchAsync = require("../../../core/utils/catchAsync");
const AppError = require("../../../core/utils/errorHandler");
const accountLinkingService = require("../services/accountLinking.service");
const accountVerificationService = require("../services/accountVerification.service");
const competitiveProfileService = require("../services/competitiveProfile.service");

const linkAccounts = catchAsync(async (req, res) => {
  const linked = await accountLinkingService.linkAccounts(req.user._id, req.body);
  res.status(200).json({ success: true, message: "Accounts linked successfully", data: linked });
});

const startVerification = catchAsync(async (req, res) => {
  const { platform } = req.body;
  const result = await accountVerificationService.startVerification(req.user._id, platform);
  res.status(200).json({ success: true, message: "Verification started", data: result });
});

const checkVerification = catchAsync(async (req, res) => {
  const { platform } = req.body;
  const result = await accountVerificationService.checkVerification(req.user._id, platform);
  res.status(200).json({
    success: true,
    message: result.verified ? "Account verified" : "Verification pending",
    data: result,
  });
});

const getProfile = catchAsync(async (req, res) => {
  const { userId } = req.params;
  const roleName = String(req.user?.role?.name || req.user?.role || "").toLowerCase();
  if (String(req.user._id) !== String(userId) && roleName !== "admin" && roleName !== "super admin") {
    throw AppError.create("You are not allowed to access this profile", 403, "fail");
  }
  const profile = await competitiveProfileService.getAggregatedProfile(userId);
  res.status(200).json({ success: true, message: "Profile fetched successfully", data: profile });
});

const syncProfileNow = catchAsync(async (req, res) => {
  const force = String(req.query.force || "").toLowerCase() === "true";
  const syncResult = await competitiveProfileService.syncProfileNow(req.user._id, { force });
  res.status(200).json({ success: true, message: "Profile synced successfully", data: syncResult });
});

module.exports = { linkAccounts, startVerification, checkVerification, getProfile, syncProfileNow };
