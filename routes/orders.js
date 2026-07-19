const express = require('express');
const { protect, authorize } = require('../middleware/auth');
const {
  getOrders,
  getActiveOrders,
  getOrderById,
  createOrder,
  addItem,
  updateOrderItem,
  removeOrderItem,
  applyDiscount,
  updateNotes,
  updateStatus,
  processPayment,
  splitPayment,
  getReceiptData,
  cancelOrder,
  voidOrder,
  processRefund,
} = require('../controllers/orderController');

const router = express.Router();

router.use(protect);

router.get('/active', getActiveOrders);
router.get('/', getOrders);
router.get('/:id', getOrderById);
router.post('/', createOrder);
router.put('/:id/add-item', addItem);
router.put('/:id/update-item/:itemId', updateOrderItem);
router.put('/:id/remove-item/:itemId', removeOrderItem);
router.put('/:id/discount', applyDiscount);
router.put('/:id/notes', updateNotes);
router.put('/:id/status', updateStatus);
router.post('/:id/payment', processPayment);
router.post('/:id/split-payment', splitPayment);
router.get('/:id/receipt', getReceiptData);
router.put('/:id/cancel', authorize('admin', 'manager'), cancelOrder);
router.put('/:id/void', authorize('admin', 'manager'), voidOrder);
router.post('/:id/refund', authorize('admin', 'manager'), processRefund);

module.exports = router;
