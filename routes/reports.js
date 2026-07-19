const express = require('express');
const { protect, authorize } = require('../middleware/auth');
const {
  getDailySalesReport,
  getPaymentSummary,
  getWaiterPerformance,
  getInventoryReport,
  getRevenueReport,
  getReservationReport,
} = require('../controllers/reportController');

const router = express.Router();

router.get('/daily-sales', protect, getDailySalesReport);
router.get('/payments', protect, getPaymentSummary);
router.get('/waiter-performance', protect, getWaiterPerformance);
router.get('/inventory', protect, getInventoryReport);
router.get('/revenue', protect, getRevenueReport);
router.get('/reservations', protect, getReservationReport);

module.exports = router;
