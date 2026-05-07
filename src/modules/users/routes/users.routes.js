const express = require("express");
const { authenticate } = require("../../../core/middlewares/auth.middleware");
const userController = require("../controllers/user.controller");

const router = express.Router();

router.get("/me", authenticate, userController.getMe);

module.exports = router;
