const reportService = require('../services/reportService');

const getDailySalesReport = async (req, res) => {
  try {
    const { startDate, endDate, branch } = req.query;
    const branchId = branch || req.user.branch || null;
    const report = await reportService.getDailySalesReport({ startDate, endDate, branch: branchId });
    res.status(200).json({ success: true, data: report });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getPaymentSummary = async (req, res) => {
  try {
    const { startDate, endDate, branch } = req.query;
    const branchId = branch || req.user.branch || null;
    const report = await reportService.getPaymentSummary({ startDate, endDate, branch: branchId });
    res.status(200).json({ success: true, data: report });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getWaiterPerformance = async (req, res) => {
  try {
    const { startDate, endDate, branch } = req.query;
    const branchId = branch || req.user.branch || null;
    const report = await reportService.getWaiterPerformance({ startDate, endDate, branch: branchId });
    res.status(200).json({ success: true, data: report });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getInventoryReport = async (req, res) => {
  try {
    const { startDate, endDate, branch } = req.query;
    const branchId = branch || req.user.branch || null;
    const report = await reportService.getInventoryReport({ startDate, endDate, branch: branchId });
    res.status(200).json({ success: true, data: report });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getRevenueReport = async (req, res) => {
  try {
    const { startDate, endDate, branch, granularity } = req.query;
    const branchId = branch || req.user.branch || null;
    const report = await reportService.getRevenueReport({ startDate, endDate, branch: branchId, granularity });
    res.status(200).json({ success: true, data: report });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getReservationReport = async (req, res) => {
  try {
    const { startDate, endDate, branch } = req.query;
    const branchId = branch || req.user.branch || null;
    const report = await reportService.getReservationReport({ startDate, endDate, branch: branchId });
    res.status(200).json({ success: true, data: report });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getDailySalesReport,
  getPaymentSummary,
  getWaiterPerformance,
  getInventoryReport,
  getRevenueReport,
  getReservationReport,
};
