require("../models/permission.model"); // ده بيسجل الموديل في المونجوس بسconst Role = require("../../models/role.model");
let httpStatus = require("http-status");
if (httpStatus.default) httpStatus = httpStatus.default;

const bcrypt = require("bcryptjs");
const { OAuth2Client } = require("google-auth-library");
const Role = require("../models/role.model");
const User = require("../../users/models/user.model");
const Token = require("../models/token.model");
const Otp = require("../models/otp.model");
const tokenService = require("./token.service");
const axios = require("axios"); 
const rolePopulateOptions = {
  path: "role",
  populate: { path: "permissions" },
};

const gmailRegex = /^[a-zA-Z0-9._%+-]+@gmail\.com$/i;
let googleClient;

const sanitizeUser = (user) => {
  const userObject = user.toObject ? user.toObject() : { ...user };
  delete userObject.password;
  return userObject;
};

const validateGmailEmail = (email) => gmailRegex.test(String(email || "").trim());

const createServiceError = (message, statusCode = httpStatus.BAD_REQUEST) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const getGoogleClient = () => {
  if (!googleClient) {
    googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
  }
  return googleClient;
};

const sendOtpEmail = async (toEmail, otp) => {
  try {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        accept: "application/json",
        "api-key": process.env.BREVO_API_KEY,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        sender: { name: "Nibras Platform", email: "nibras.auth@gmail.com" },
        to: [{ email: toEmail }],
        subject: "Nibras OTP Verification Code",
        htmlContent: `
          <div style="font-family: Arial, sans-serif; text-align: center; padding: 30px; background-color: #f9f9f9; border-radius: 10px; max-width: 500px; margin: auto;">
            <h2 style="color: #333;">Welcome to Nibras Platform</h2>
            <h1 style="color: #4CAF50; letter-spacing: 8px; font-size: 36px; margin: 20px 0;">${otp}</h1>
          </div>
        `,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error("Brevo API rejected OTP email request:", errorData);
    }
  } catch (error) {
    console.error("Network/Fetch error in sendOtpEmail:", error.message);
  }
};

const generateSixDigitOtp = () => String(Math.floor(100000 + Math.random() * 900000));

const registerStudent = async (userData) => {
  const { name, email, password } = userData;
  const roleName = "Student";

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw createServiceError("Email is already registered.", httpStatus.BAD_REQUEST);
  }

  const assignedRole = await Role.findOne({ name: roleName });
  if (!assignedRole) {
    throw createServiceError(`Role ${roleName} not found.`, httpStatus.INTERNAL_SERVER_ERROR);
  }

  const user = await User.create({
    name,
    email,
    password,
    isVerified: true,
    authProvider: "manual",
    role: assignedRole._id,
  });

  const populatedUser = await User.findById(user._id).populate(rolePopulateOptions);
  const tokens = await tokenService.generateAuthTokens(populatedUser);

  return { tokens, user: sanitizeUser(populatedUser) };
};

const registerManual = async (userData) => {
  const { name, email, password } = userData;
  const normalizedEmail = String(email || "").trim().toLowerCase();

  if (!name || !normalizedEmail || !password) {
    throw createServiceError("Name, email, and password are required.");
  }

  if (!validateGmailEmail(normalizedEmail)) {
    throw createServiceError("Only @gmail.com addresses are allowed.");
  }

  const existingUser = await User.findOne({ email: normalizedEmail });
  if (existingUser) {
    throw createServiceError("Email is already registered.");
  }

  const assignedRole = await Role.findOne({ name: "Student" });
  if (!assignedRole) {
    throw createServiceError("Role Student not found.", httpStatus.INTERNAL_SERVER_ERROR);
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const user = await User.create({
    name,
    email: normalizedEmail,
    password: hashedPassword,
    role: assignedRole._id,
    isVerified: false,
    authProvider: "manual",
  });

  const otpCode = generateSixDigitOtp();
  await Otp.findOneAndUpdate(
  { email: normalizedEmail },
  { email: normalizedEmail, otp: otpCode, createdAt: new Date() },
  { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true } // التعديل هنا
);
  await sendOtpEmail(normalizedEmail, otpCode);
  return { user: sanitizeUser(user) };
};

const verifyOtp = async ({ email, otp }) => {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const normalizedOtp = String(otp || "").trim();

  if (!normalizedEmail || !normalizedOtp) {
    throw createServiceError("Email and OTP are required.");
  }

  if (!validateGmailEmail(normalizedEmail)) {
    throw createServiceError("Only @gmail.com addresses are allowed.");
  }

  const otpDoc = await Otp.findOne({ email: normalizedEmail, otp: normalizedOtp });
  if (!otpDoc) {
    throw createServiceError("Invalid or expired OTP.", httpStatus.UNAUTHORIZED);
  }

  const user = await User.findOne({ email: normalizedEmail }).populate(rolePopulateOptions);
  if (!user) {
    throw createServiceError("User not found.", httpStatus.NOT_FOUND);
  }

  user.isVerified = true;
  await user.save();
  await Otp.deleteOne({ _id: otpDoc._id });

  const tokens = await tokenService.generateAuthTokens(user);
  return { tokens, user: sanitizeUser(user) };
};

const googleLogin = async ({ access_token }) => {
  if (!access_token) {
    throw createServiceError("access_token is required.");
  }

  let payload;
  try {
    // هنجيب بيانات اليوزر من جوجل باستخدام التوكن
    const googleResponse = await axios.get(
      "https://www.googleapis.com/oauth2/v3/userinfo",
      {
        headers: { Authorization: `Bearer ${access_token}` },
      }
    );
    payload = googleResponse.data;
  } catch (error) {
    throw createServiceError("Invalid Google access token.", httpStatus.UNAUTHORIZED);
  }

  const normalizedEmail = String(payload?.email || "").trim().toLowerCase();

  if (!payload?.email_verified) {
    throw createServiceError("Google account email is not verified.", httpStatus.UNAUTHORIZED);
  }

  if (!validateGmailEmail(normalizedEmail)) {
    throw createServiceError("Only @gmail.com addresses are allowed.");
  }

  const assignedRole = await Role.findOne({ name: "Student" });
  if (!assignedRole) {
    throw createServiceError("Role Student not found.", httpStatus.INTERNAL_SERVER_ERROR);
  }

  let user = await User.findOne({ email: normalizedEmail });
  
  if (!user) {
    user = await User.create({
      name: payload?.name || "Google User",
      email: normalizedEmail,
      role: assignedRole._id,
      isVerified: true,
      authProvider: "google",
    });
  } else {
    user.isVerified = true;
    user.authProvider = "google";
    if (!user.role) {
      user.role = assignedRole._id;
    }
    await user.save();
  }

  // نطلع الـ Tokens بتاعت نبراس ونرجعها للكنترولر
  const populatedUser = await User.findById(user._id).populate(rolePopulateOptions);
  const tokens = await tokenService.generateAuthTokens(populatedUser);
  return { tokens, user: sanitizeUser(populatedUser) };
};

const loginStudent = async ({ email, password }) => {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const user = await User.findOne({ email: normalizedEmail })
    .select("+password")
    .populate(rolePopulateOptions);

  const isMatch = user && user.password ? await user.comparePassword(password) : false;

  if (!user || !isMatch) {
    throw createServiceError("Invalid email or password.", httpStatus.UNAUTHORIZED);
  }

  if (user.authProvider === "manual" && !user.isVerified) {
    throw createServiceError("Account is not verified. Please verify your OTP first.", httpStatus.FORBIDDEN);
  }

  const tokens = await tokenService.generateAuthTokens(user);
  return { tokens, user: sanitizeUser(user) };
};

const getStudentProfile = async (studentId) => {
  const user = await User.findById(studentId).populate(rolePopulateOptions);
  if (!user) {
    throw createServiceError("User not found.", httpStatus.NOT_FOUND);
  }
  return sanitizeUser(user);
};

const logout = async (refreshToken, userId) => {
  const refreshTokenDoc = await Token.findOne({
    token: refreshToken,
    type: "refresh",
    blacklisted: false,
  });

  if (!refreshTokenDoc) {
    throw createServiceError("Refresh token not found or already logged out.", httpStatus.NOT_FOUND);
  }

  if (refreshTokenDoc.user.toString() !== userId.toString()) {
    throw createServiceError("Unauthorized: You cannot revoke someone else's session.", httpStatus.FORBIDDEN);
  }

  await refreshTokenDoc.deleteOne();
  return { success: true, message: "Logged out successfully" };
};

const refreshAuth = async (refreshToken) => {
  if (!refreshToken) {
    throw createServiceError("Refresh token required.", httpStatus.BAD_REQUEST);
  }

  const refreshTokenDoc = await Token.findOne({ token: refreshToken, type: "refresh" });
  if (!refreshTokenDoc) {
    throw createServiceError("Invalid refresh token.", httpStatus.UNAUTHORIZED);
  }

  const payload = tokenService.verifyRefreshToken(refreshToken);
  const user = await User.findById(payload.id).populate(rolePopulateOptions);
  if (!user) {
    throw createServiceError("User not found.", httpStatus.UNAUTHORIZED);
  }

  await refreshTokenDoc.deleteOne();
  const tokens = await tokenService.generateAuthTokens(user);
  return { tokens, user: sanitizeUser(user) };
};

module.exports = {
  registerManual,
  verifyOtp,
  googleLogin,
  registerStudent,
  loginStudent,
  getStudentProfile,
  logout,
  refreshAuth,
};
