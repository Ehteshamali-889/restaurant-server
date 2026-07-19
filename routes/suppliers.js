const express = require('express');
const { protect, authorize } = require('../middleware/auth');
const {
  getSuppliers,
  getSupplierById,
  createSupplier,
  updateSupplier,
  deleteSupplier,
} = require('../controllers/supplierController');

const router = express.Router();

router.use(protect);

router.get('/', getSuppliers);
router.get('/:id', getSupplierById);
router.post('/', authorize('admin', 'manager'), createSupplier);
router.put('/:id', authorize('admin', 'manager'), updateSupplier);
router.delete('/:id', authorize('admin', 'manager'), deleteSupplier);

module.exports = router;
