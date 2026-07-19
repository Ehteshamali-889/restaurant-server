const dashboardService = require('../services/dashboardService');

const getDashboard = async (req, res) => {
  try {
    const branchId = req.query.branch || req.user.branch || null;
    const summary = await dashboardService.getDailySummary(branchId);

    res.status(200).json({
      success: true,
      data: summary,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = { getDashboard };
