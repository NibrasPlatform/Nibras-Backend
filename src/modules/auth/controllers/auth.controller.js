let httpStatus = require("http-status");
if (httpStatus.default) httpStatus = httpStatus.default;

const catchAsync = require("../../../core/utils/catchAsync");
const authService = require("../services/auth.service");

const registerManual = catchAsync(async (req, res) => {
  const result = await authService.registerManual(req.body);
  res.status(httpStatus.CREATED).json({
    success: true,
    message: "Registration successful. OTP sent to your email.",
    data: result.user,
  });
});

const verifyOtp = catchAsync(async (req, res) => {
  const result = await authService.verifyOtp(req.body);
  res.status(httpStatus.OK).json({
    success: true,
    message: "OTP verified successfully.",
    token: result.tokens.access.token,
    tokens: result.tokens,
    data: result.user,
  });
});

const googleLogin = catchAsync(async (req, res) => {
  const result = await authService.googleLogin(req.body);
  res.status(httpStatus.OK).json({
    success: true,
    message: "Google login successful.",
    token: result.tokens.access.token,
    tokens: result.tokens,
    data: result.user,
  });
});

const login = catchAsync(async (req, res) => {
  const loginResult = await authService.loginStudent(req.body);
  res.status(httpStatus.OK).json({
    success: true,
    message: "Login successful.",
    tokens: loginResult.tokens,
    data: loginResult.user,
  });
});

const getMe = catchAsync(async (req, res) => {
  const user = await authService.getStudentProfile(req.user._id);
  res.status(httpStatus.OK).json({
    success: true,
    data: user,
  });
});

const logout = catchAsync(async (req, res) => {
  const result = await authService.logout(req.body.refreshToken, req.user._id);
  res.status(httpStatus.OK).json({
    success: true,
    message: result.message,
  });
});

const refreshTokens = catchAsync(async (req, res) => {
  const refreshResult = await authService.refreshAuth(req.body.refreshToken);
  res.status(httpStatus.OK).json({
    success: true,
    message: "Tokens refreshed successfully.",
    tokens: refreshResult.tokens,
    data: refreshResult.user,
  });
});

module.exports = {
  registerManual,
  verifyOtp,
  googleLogin,
  login,
  getMe,
  logout,
  refreshTokens,
};
