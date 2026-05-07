const User = require("../models/user.model");

const getById = async (id) => {
  return User.findById(id).populate({
    path: "role",
    populate: { path: "permissions" },
  });
};

module.exports = {
  getById,
};
