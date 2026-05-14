const authorize = (...requiredPermissions) => {
  return (req, res, next) => {
    try {
      if (!req.user || !req.user.role) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized: user data missing.",
        });
      }

      if (req.user.role.name === "Super Admin") {
        return next();
      }

      const userPermissions = req.user.role.permissions || [];
      const hasPermission = requiredPermissions.every((requiredPermission) =>
        userPermissions.some((permission) => permission.name === requiredPermission)
      );

      if (!hasPermission) {
        return res.status(403).json({
          success: false,
          message: `Forbidden: missing required permissions [${requiredPermissions.join(", ")}].`,
        });
      }

      next();
    } catch (error) {
      console.error("Authorization error:", error);
      res.status(500).json({ success: false, message: "Authorization check failed." });
    }
  };
};

const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: user role not found.",
      });
    }

    const roleName = req.user.role.name;
    if (!allowedRoles.includes(roleName)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: only [${allowedRoles.join(", ")}] can access this resource.`,
      });
    }

    return next();
  };
};

const roleMiddleware = (...legacyRoles) => {
  const normalizedRoles = legacyRoles
    .map((role) => String(role || "").trim().toLowerCase())
    .flatMap((role) => {
      if (role === "admin") return ["Admin", "Super Admin"];
      if (role === "instructor") return ["Instructor"];
      if (role === "ta") return ["TA"];
      if (role === "student") return ["Student"];
      return [];
    });

  return authorizeRoles(...normalizedRoles);
};

roleMiddleware.authorize = authorize;
roleMiddleware.authorizeRoles = authorizeRoles;

module.exports = roleMiddleware;
