const catchAsync = require("../../../core/utils/catchAsync");
const AppError = require("../../../core/utils/errorHandler");
const userService = require("../services/user.service");

const getMe = catchAsync(async (req, res) => {
  const user = await userService.getById(req.user._id);
  if (!user) throw AppError.create("User not found", 404, "fail");
  res.status(200).json({ success: true, message: "Profile fetched successfully", data: user });
});

module.exports = { getMe };
