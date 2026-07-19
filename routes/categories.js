const express = require('express');
const { protect, authorize } = require('../middleware/auth');
const {
  getCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
} = require('../controllers/menuController');

const router = express.Router();

router.use(protect);

router.get('/', getCategories);
router.get('/:id', getCategoryById);
router.post('/', authorize('admin', 'manager'), createCategory);
router.put('/:id', authorize('admin', 'manager'), updateCategory);
router.delete('/:id', authorize('admin', 'manager'), deleteCategory);

module.exports = router;
