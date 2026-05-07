const AppError = require("../../../core/utils/errorHandler");
const status = require("../../../core/constants/httpStatus");
const accountLinkingService = require("../services/accountLinking.service");
const accountVerificationService = require("../services/accountVerification.service");
const competitiveProfileService = require("../services/competitiveProfile.service");

const linkAccounts = async (req, res, next) => {
  try {
    const linked = await accountLinkingService.linkAccounts(req.user._id, req.body);
    res.status(200).json({
      status: 200,
      message: "Accounts linked successfully",
      data: linked,
    });
  } catch (error) {
    next(error);
  }
};

const startVerification = async (req, res, next) => {
  try {
    const { platform } = req.body;
    const result = await accountVerificationService.startVerification(req.user._id, platform);
    res.status(200).json({
      status: 200,
      message: "Verification started",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

const checkVerification = async (req, res, next) => {
  try {
    const { platform } = req.body;
    const result = await accountVerificationService.checkVerification(req.user._id, platform);
    res.status(200).json({
      status: 200,
      message: result.verified ? "Account verified" : "Verification pending",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

const getProfile = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const roleName = String(req.user?.role?.name || req.user?.role || "").toLowerCase();
    if (String(req.user._id) !== String(userId) && roleName !== "admin" && roleName !== "super admin") {
      throw AppError.create("You are not allowed to access this profile", 403, status.Fail, {
        errorCode: "FORBIDDEN",
      });
    }

    const profile = await competitiveProfileService.getAggregatedProfile(userId);
    res.status(200).json({
      status: 200,
      data: profile,
    });
  } catch (error) {
    next(error);
  }
};

const syncProfileNow = async (req, res, next) => {
  try {
    const force = req.query.force === true;
    const syncResult = await competitiveProfileService.syncProfileNow(req.user._id, { force });

    res.status(200).json({
      status: 200,
      data: syncResult,
    });
  } catch (error) {
    if (error.errorCode === "TOO_MANY_REQUESTS" || error.errorCode === "SYNC_IN_PROGRESS") {
      return res.status(error.statusCode || 429).json({
        status: error.statusCode || 429,
        message: error.message,
      });
    }
    if (error.errorCode === "SYNC_COOLDOWN_ACTIVE") {
      return res.status(error.statusCode || 429).json({
        status: error.statusCode || 429,
        message: error.message,
        details: error.details || null,
      });
    }
    next(error);
  }
};

module.exports = {
  linkAccounts,
  startVerification,
  checkVerification,
  getProfile,
  syncProfileNow,
};
