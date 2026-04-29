const jwt = require("jsonwebtoken");
const User = require("../../modules/users/models/user.model");

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: missing authorization header.",
      });
    }

    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7).trim()
      : authHeader.trim();

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: missing token.",
      });
    }

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({
        success: false,
        message: "Server misconfiguration: JWT_SECRET is missing.",
      });
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const userId = payload.id || payload.userId || payload._id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: invalid token payload.",
      });
    }

    const user = await User.findById(userId).populate({
      path: "role",
      populate: { path: "permissions" },
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: user not found.",
      });
    }

    req.user = user;
    return next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: token has expired.",
      });
    }

    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: invalid token.",
      });
    }

    console.error("Authentication middleware error:", error);
    return res.status(401).json({
      success: false,
      message: "Unauthorized: authentication failed.",
    });
  }
};

module.exports = {
  authenticate,
};
