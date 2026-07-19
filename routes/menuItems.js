const express = require('express');
const { protect, authorize } = require('../middleware/auth');
const {
  getMenuItems,
  getMenuItemById,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
  toggleAvailability,
} = require('../controllers/menuController');

const router = express.Router();

router.use(protect);

router.get('/', getMenuItems);
router.get('/:id', getMenuItemById);
router.post('/', authorize('admin', 'manager'), createMenuItem);
router.put('/:id', authorize('admin', 'manager'), updateMenuItem);
router.delete('/:id', authorize('admin', 'manager'), deleteMenuItem);
router.patch('/:id/toggle', toggleAvailability);

module.exports = router;
