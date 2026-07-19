const stockService = require('../services/stockService');

const getStockItems = async (req, res) => {
  try {
    const filters = {
      branch: req.query.branch || req.user.branch,
      category: req.query.category,
      lowStock: req.query.lowStock === 'true',
      outOfStock: req.query.outOfStock === 'true',
      search: req.query.search,
    };
    const items = await stockService.getStockItems(filters);
    res.status(200).json({ success: true, data: items });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getStockItemById = async (req, res) => {
  try {
    const item = await stockService.getStockItemById(req.params.id);
    if (!item) {
      return res.status(404).json({ success: false, message: 'Article non trouve' });
    }
    res.status(200).json({ success: true, data: item });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const createStockItem = async (req, res) => {
  try {
    const item = await stockService.createStockItem({ ...req.body, branch: req.user.branch });
    res.status(201).json({ success: true, data: item });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const updateStockItem = async (req, res) => {
  try {
    const item = await stockService.updateStockItem(req.params.id, req.body);
    if (!item) {
      return res.status(404).json({ success: false, message: 'Article non trouve' });
    }
    res.status(200).json({ success: true, data: item });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const deleteStockItem = async (req, res) => {
  try {
    const item = await stockService.deleteStockItem(req.params.id);
    if (!item) {
      return res.status(404).json({ success: false, message: 'Article non trouve' });
    }
    res.status(200).json({ success: true, data: {} });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const adjustStock = async (req, res) => {
  try {
    const { quantityChange, type, reason } = req.body;
    const result = await stockService.adjustStock(req.params.id, {
      quantityChange,
      type,
      reason,
      performedBy: req.user._id,
      branch: req.user.branch,
    });
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const getStockHistory = async (req, res) => {
  try {
    const filters = {
      stockItem: req.query.stockItem,
      branch: req.query.branch || req.user.branch,
      type: req.query.type,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      page: req.query.page,
      limit: req.query.limit,
    };
    const history = await stockService.getStockHistory(filters);
    res.status(200).json({ success: true, data: history.data, pagination: history.pagination });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getInventoryDashboard = async (req, res) => {
  try {
    const branch = req.query.branch || req.user.branch;
    const dashboard = await stockService.getInventoryDashboard(branch);
    res.status(200).json({ success: true, data: dashboard });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const createPurchaseOrder = async (req, res) => {
  try {
    const po = await stockService.createPurchaseOrder({
      ...req.body,
      createdBy: req.user._id,
      branch: req.user.branch,
    });
    res.status(201).json({ success: true, data: po });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const getPurchaseOrders = async (req, res) => {
  try {
    const filters = {
      branch: req.query.branch || req.user.branch,
      status: req.query.status,
      supplier: req.query.supplier,
      page: req.query.page,
      limit: req.query.limit,
    };
    const orders = await stockService.getPurchaseOrders(filters);
    res.status(200).json({ success: true, data: orders.data, pagination: orders.pagination });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getPurchaseOrderById = async (req, res) => {
  try {
    const order = await stockService.getPurchaseOrderById(req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Bon de commande non trouve' });
    }
    res.status(200).json({ success: true, data: order });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const updatePurchaseOrder = async (req, res) => {
  try {
    const order = await stockService.updatePurchaseOrder(req.params.id, req.body);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Bon de commande non trouve' });
    }
    res.status(200).json({ success: true, data: order });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const receivePurchaseOrder = async (req, res) => {
  try {
    const order = await stockService.receivePurchaseOrder(req.params.id, req.user._id);
    res.status(200).json({ success: true, data: order });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const cancelPurchaseOrder = async (req, res) => {
  try {
    const order = await stockService.cancelPurchaseOrder(req.params.id);
    res.status(200).json({ success: true, data: order });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

module.exports = {
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
};
