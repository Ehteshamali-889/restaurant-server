const express = require('express');
const { protect, authorize } = require('../middleware/auth');
const {
  getTables,
  getTableStats,
  getTableById,
  createTable,
  updateTable,
  assignWaiter,
  updateStatus,
  deleteTable,
} = require('../controllers/tableController');

const router = express.Router();

router.use(protect);

router.get('/stats', getTableStats);
router.get('/', getTables);
router.get('/:id', getTableById);
router.post('/', authorize('admin', 'manager'), createTable);
router.put('/:id', authorize('admin', 'manager'), updateTable);
router.put('/:id/assign', assignWaiter);
router.put('/:id/status', updateStatus);
router.delete('/:id', authorize('admin', 'manager'), deleteTable);

module.exports = router;
