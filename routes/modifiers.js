const express = require('express');
const { protect, authorize } = require('../middleware/auth');
const {
  getModifiers,
  getModifierById,
  createModifier,
  updateModifier,
  deleteModifier,
} = require('../controllers/menuController');

const router = express.Router();

router.use(protect);

router.get('/', getModifiers);
router.get('/:id', getModifierById);
router.post('/', authorize('admin', 'manager'), createModifier);
router.put('/:id', authorize('admin', 'manager'), updateModifier);
router.delete('/:id', authorize('admin', 'manager'), deleteModifier);

module.exports = router;
