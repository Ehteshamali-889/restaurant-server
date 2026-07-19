const Supplier = require('../models/Supplier');
const StockItem = require('../models/StockItem');

const getSuppliers = async (filters = {}) => {
  const query = {};
  if (filters.branch) query.branch = filters.branch;
  if (filters.isActive !== undefined) query.isActive = filters.isActive;
  if (filters.search) {
    query.$or = [
      { name: { $regex: filters.search, $options: 'i' } },
      { contactPerson: { $regex: filters.search, $options: 'i' } },
      { email: { $regex: filters.search, $options: 'i' } },
    ];
  }
  return Supplier.find(query).sort({ name: 1 });
};

const getSupplierById = async (id) => {
  return Supplier.findById(id);
};

const createSupplier = async (data) => {
  return Supplier.create(data);
};

const updateSupplier = async (id, data) => {
  return Supplier.findByIdAndUpdate(id, data, { new: true, runValidators: true });
};

const deleteSupplier = async (id) => {
  const itemCount = await StockItem.countDocuments({ supplier: id });
  if (itemCount > 0) {
    throw new Error(`Cannot delete supplier: ${itemCount} stock item(s) still reference it`);
  }
  return Supplier.findByIdAndDelete(id);
};

const getSupplierStats = async (branchId) => {
  const filter = {};
  if (branchId) filter.branch = branchId;

  const [total, active] = await Promise.all([
    Supplier.countDocuments(filter),
    Supplier.countDocuments({ ...filter, isActive: true }),
  ]);

  return { total, active, inactive: total - active };
};

module.exports = {
  getSuppliers,
  getSupplierById,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  getSupplierStats,
};
