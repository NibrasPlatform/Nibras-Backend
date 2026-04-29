const router = require("express").Router();
const authMiddleware = require("../../../core/middlewares/auth.middleware");
const valid = require("../../../core/middlewares/validation.middleware");
const accountController = require("../controllers/account.controller");
const accountValidator = require("../validation/account.validator");

router.use(authMiddleware.authenticate);

router.post(
  "/link",
  accountValidator.linkAccountsValidator,
  valid,
  accountController.linkAccounts,
);

router.post(
  "/verify/start",
  accountValidator.startVerificationValidator,
  valid,
  accountController.startVerification,
);

router.post(
  "/verify/check",
  accountValidator.checkVerificationValidator,
  valid,
  accountController.checkVerification,
);

router.get(
  "/profile/:userId",
  accountValidator.getProfileValidator,
  valid,
  accountController.getProfile,
);

router.post(
  "/profile/sync",
  accountValidator.syncProfileValidator,
  valid,
  accountController.syncProfileNow,
);

module.exports = router;
