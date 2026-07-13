const approveApplication = require("./center-applications/[id]/approve");

module.exports = function handler(req, res) {
  req.query = req.query || {};
  return approveApplication(req, res);
};
