const express = require("express");
const authController = require("../controllers/auth.controller");
const { authenticate } = require("../../../core/middlewares/auth.middleware");

const router = express.Router();

router.post("/register", authController.registerManual);
router.post("/verify-otp", authController.verifyOtp);
router.post("/google", authController.googleLogin);
router.post("/login", authController.login);
router.post("/refresh-tokens", authController.refreshTokens);

router.get("/me", authenticate, authController.getMe);
router.post("/logout", authenticate, authController.logout);
router.post("/forgot-password", authController.forgotPassword);
router.post("/reset-password", authController.resetPassword);

module.exports = router;
