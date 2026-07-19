const supplierService = require('../services/supplierService');

const getSuppliers = async (req, res) => {
  try {
    const filters = {
      branch: req.query.branch || req.user.branch,
      isActive: req.query.isActive !== undefined ? req.query.isActive === 'true' : undefined,
      search: req.query.search,
    };
    const suppliers = await supplierService.getSuppliers(filters);
    res.status(200).json({ success: true, data: suppliers });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getSupplierById = async (req, res) => {
  try {
    const supplier = await supplierService.getSupplierById(req.params.id);
    if (!supplier) {
      return res.status(404).json({ success: false, message: 'Fournisseur non trouve' });
    }
    res.status(200).json({ success: true, data: supplier });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const createSupplier = async (req, res) => {
  try {
    const supplier = await supplierService.createSupplier({ ...req.body, branch: req.user.branch });
    res.status(201).json({ success: true, data: supplier });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: 'Un fournisseur avec ce nom existe deja' });
    }
    res.status(400).json({ success: false, message: error.message });
  }
};

const updateSupplier = async (req, res) => {
  try {
    const supplier = await supplierService.updateSupplier(req.params.id, req.body);
    if (!supplier) {
      return res.status(404).json({ success: false, message: 'Fournisseur non trouve' });
    }
    res.status(200).json({ success: true, data: supplier });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: 'Un fournisseur avec ce nom existe deja' });
    }
    res.status(400).json({ success: false, message: error.message });
  }
};

const deleteSupplier = async (req, res) => {
  try {
    const supplier = await supplierService.deleteSupplier(req.params.id);
    if (!supplier) {
      return res.status(404).json({ success: false, message: 'Fournisseur non trouve' });
    }
    res.status(200).json({ success: true, data: {} });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

module.exports = {
  getSuppliers,
  getSupplierById,
  createSupplier,
  updateSupplier,
  deleteSupplier,
};
