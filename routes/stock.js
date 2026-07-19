const express = require('express');
const { protect, authorize } = require('../middleware/auth');
const {
  getStockItems,
  getStockItemById,
  createStockItem,
  updateStockItem,
  deleteStockItem,
  adjustStock,
  getStockHistory,
  getInventoryDashboard,
  createPurchaseOrder,
  getPurchaseOrders,
  getPurchaseOrderById,
  updatePurchaseOrder,
  receivePurchaseOrder,
  cancelPurchaseOrder,
} = require('../controllers/stockController');

const router = express.Router();

router.use(protect);

router.get('/dashboard', getInventoryDashboard);
router.get('/history', getStockHistory);
router.get('/purchase-orders', getPurchaseOrders);
router.post('/purchase-orders', authorize('admin', 'manager'), createPurchaseOrder);
router.get('/purchase-orders/:id', getPurchaseOrderById);
router.put('/purchase-orders/:id', authorize('admin', 'manager'), updatePurchaseOrder);
router.put('/purchase-orders/:id/receive', authorize('admin', 'manager'), receivePurchaseOrder);
router.put('/purchase-orders/:id/cancel', authorize('admin', 'manager'), cancelPurchaseOrder);

router.get('/', getStockItems);
router.get('/:id', getStockItemById);
router.post('/', authorize('admin', 'manager'), createStockItem);
router.put('/:id', authorize('admin', 'manager'), updateStockItem);
router.delete('/:id', authorize('admin', 'manager'), deleteStockItem);
router.put('/:id/adjust', authorize('admin', 'manager'), adjustStock);

module.exports = router;
