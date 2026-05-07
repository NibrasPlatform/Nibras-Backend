const httpStatus = require("http-status");

const Success = "Success";
const Fail = "Fail";
const Error = "Error";

module.exports = {
  ...httpStatus,
  Success,
  Fail,
  Error,
};
