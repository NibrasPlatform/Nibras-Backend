const userService = require("../services/user.service");

const getMe = async (req, res, next) => {
  try {
    const user = await userService.getById(req.user.id || req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getMe,
};
