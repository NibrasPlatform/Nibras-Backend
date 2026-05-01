const router = require("express").Router();
const authMiddleware = require("../../../core/middlewares/auth.middleware");
const valid = require("../../../core/middlewares/validation.middleware");
const accountController = require("../controllers/account.controller");
const accountValidator = require("../validation/account.validator");

router.use(authMiddleware.authenticate);

router.post(
  "/link",
  valid(accountValidator.linkAccountsValidator),
  accountController.linkAccounts,
);

router.post(
  "/verify/start",
  valid(accountValidator.startVerificationValidator),
  accountController.startVerification,
);

router.post(
  "/verify/check",
  valid(accountValidator.checkVerificationValidator),
  accountController.checkVerification,
);

router.get(
  "/profile/:userId",
  valid(accountValidator.getProfileValidator),
  accountController.getProfile,
);

router.post(
  "/profile/sync",
  valid(accountValidator.syncProfileValidator),
  accountController.syncProfileNow,
);

module.exports = router;
