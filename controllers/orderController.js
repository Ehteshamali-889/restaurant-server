const orderService = require('../services/orderService');

const getOrders = async (req, res) => {
  try {
    const filters = {
      branch: req.query.branch || req.user.branch,
      status: req.query.status,
      table: req.query.table,
      waiter: req.query.waiter,
      paymentMethod: req.query.paymentMethod,
      paymentStatus: req.query.paymentStatus,
      dateFrom: req.query.dateFrom,
      dateTo: req.query.dateTo,
      date: req.query.date,
      search: req.query.search,
      page: req.query.page,
      limit: req.query.limit,
    };
    const result = await orderService.getOrders(filters);
    res.status(200).json({ success: true, data: result.orders, pagination: result.pagination });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getActiveOrders = async (req, res) => {
  try {
    const branchId = req.query.branch || req.user.branch;
    const orders = await orderService.getActiveOrders(branchId);
    res.status(200).json({ success: true, data: orders });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getOrderById = async (req, res) => {
  try {
    const order = await orderService.getOrderById(req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    res.status(200).json({ success: true, data: order });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const createOrder = async (req, res) => {
  try {
    const data = {
      table: req.body.table,
      waiter: req.body.waiter || req.user._id,
      cashier: req.user._id,
      branch: req.body.branch || req.user.branch,
      items: req.body.items,
      notes: req.body.notes,
    };
    const order = await orderService.createOrder(data);
    res.status(201).json({ success: true, data: order });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const addItem = async (req, res) => {
  try {
    const order = await orderService.addItem(req.params.id, req.body);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    res.status(200).json({ success: true, data: order });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const updateOrderItem = async (req, res) => {
  try {
    const order = await orderService.updateOrderItem(req.params.id, req.params.itemId, req.body);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    res.status(200).json({ success: true, data: order });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const removeOrderItem = async (req, res) => {
  try {
    const result = await orderService.removeOrderItem(req.params.id, req.params.itemId);
    if (result === null) {
      return res.status(200).json({ success: true, message: 'Order deleted (no items left)', data: null });
    }
    if (!result) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const applyDiscount = async (req, res) => {
  try {
    const { discountType, discountValue } = req.body;
    const order = await orderService.applyDiscount(req.params.id, discountType, discountValue);
    res.status(200).json({ success: true, data: order });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const updateNotes = async (req, res) => {
  try {
    const order = await orderService.updateNotes(req.params.id, req.body.notes);
    res.status(200).json({ success: true, data: order });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const updateStatus = async (req, res) => {
  try {
    const order = await orderService.updateStatus(req.params.id, req.body.status);
    res.status(200).json({ success: true, data: order });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const processPayment = async (req, res) => {
  try {
    const { paymentMethod, paidAmount } = req.body;
    const order = await orderService.processPayment(req.params.id, paymentMethod, paidAmount);
    res.status(200).json({ success: true, data: order });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const splitPayment = async (req, res) => {
  try {
    const { payments } = req.body;
    const order = await orderService.splitPayment(req.params.id, payments);
    res.status(200).json({ success: true, data: order });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const getReceiptData = async (req, res) => {
  try {
    const receipt = await orderService.getReceiptData(req.params.id);
    res.status(200).json({ success: true, data: receipt });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const cancelOrder = async (req, res) => {
  try {
    const { reason } = req.body;
    const order = await orderService.cancelOrder(req.params.id, reason, req.user._id);
    res.status(200).json({ success: true, data: order });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const voidOrder = async (req, res) => {
  try {
    const { reason } = req.body;
    const order = await orderService.voidOrder(req.params.id, reason, req.user._id);
    res.status(200).json({ success: true, data: order });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const processRefund = async (req, res) => {
  try {
    const { amount, reason, method } = req.body;
    const order = await orderService.processRefund(
      req.params.id,
      { amount, reason, method },
      req.user._id
    );
    res.status(200).json({ success: true, data: order });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

module.exports = {
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
};
