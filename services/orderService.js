const Order = require('../models/Order');
const Table = require('../models/Table');
const MenuItem = require('../models/MenuItem');
const Branch = require('../models/Branch');

const recalcTotals = async (order) => {
  let subtotal = 0;
  for (const item of order.items) {
    if (item.status === 'cancelled') continue;
    let itemTotal = item.price * item.quantity;
    if (item.modifiers && item.modifiers.length > 0) {
      itemTotal += item.modifiers.reduce((sum, m) => sum + (m.price || 0), 0) * item.quantity;
    }
    subtotal += itemTotal;
  }

  order.subtotal = subtotal;

  let discountAmount = 0;
  if (order.discountType === 'percentage') {
    discountAmount = (subtotal * order.discountValue) / 100;
  } else if (order.discountType === 'fixed') {
    discountAmount = order.discountValue;
  }
  discountAmount = Math.min(discountAmount, subtotal);
  order.discountAmount = discountAmount;

  let taxRate = order.taxRate;
  if (!taxRate && order.branch) {
    const branch = await Branch.findById(order.branch);
    if (branch) taxRate = branch.taxRate || 0;
    order.taxRate = taxRate;
  }
  order.taxAmount = ((subtotal - discountAmount) * taxRate) / 100;
  order.total = subtotal - discountAmount + order.taxAmount;

  return order;
};

const getOrders = async (filters = {}) => {
  const query = {};
  if (filters.branch) query.branch = filters.branch;
  if (filters.status) query.status = filters.status;
  if (filters.table) query.table = filters.table;
  if (filters.waiter) query.waiter = filters.waiter;
  if (filters.paymentMethod) query.paymentMethod = filters.paymentMethod;
  if (filters.paymentStatus) query.paymentStatus = filters.paymentStatus;

  if (filters.dateFrom || filters.dateTo) {
    query.createdAt = {};
    if (filters.dateFrom) {
      const start = new Date(filters.dateFrom);
      start.setHours(0, 0, 0, 0);
      query.createdAt.$gte = start;
    }
    if (filters.dateTo) {
      const end = new Date(filters.dateTo);
      end.setHours(23, 59, 59, 999);
      query.createdAt.$lte = end;
    }
  } else if (filters.date) {
    const start = new Date(filters.date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    query.createdAt = { $gte: start, $lt: end };
  }

  if (filters.search) {
    query.orderNumber = { $regex: filters.search, $options: 'i' };
  }

  const page = Math.max(1, parseInt(filters.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(filters.limit) || 20));
  const skip = (page - 1) * limit;

  const [orders, total] = await Promise.all([
    Order.find(query)
      .populate('table', 'number section')
      .populate('waiter', 'fullName')
      .populate('cashier', 'fullName')
      .populate('items.menuItem', 'name category')
      .populate('cancelledBy', 'fullName')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Order.countDocuments(query),
  ]);

  return {
    orders,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
};

const getActiveOrders = async (branchId) => {
  const query = {
    status: { $in: ['open', 'confirmed', 'preparing', 'ready', 'served'] },
  };
  if (branchId) query.branch = branchId;

  return Order.find(query)
    .populate('table', 'number section')
    .populate('waiter', 'fullName')
    .populate('items.menuItem', 'name')
    .sort({ createdAt: -1 });
};

const getOrderById = async (id) => {
  return Order.findById(id)
    .populate('table', 'number section capacity')
    .populate('waiter', 'fullName username')
    .populate('cashier', 'fullName username')
    .populate('items.menuItem', 'name price image category')
    .populate('branch', 'name taxRate currency')
    .populate('cancelledBy', 'fullName username')
    .populate('refunds.processedBy', 'fullName username');
};

const createOrder = async (data) => {
  const order = new Order({
    table: data.table || undefined,
    waiter: data.waiter || undefined,
    cashier: data.cashier,
    branch: data.branch,
    notes: data.notes || '',
  });

  if (data.items && data.items.length > 0) {
    for (const item of data.items) {
      const menuItem = await MenuItem.findById(item.menuItem);
      if (!menuItem) throw new Error(`Menu item not found: ${item.menuItem}`);

      order.items.push({
        menuItem: menuItem._id,
        name: menuItem.name,
        quantity: item.quantity || 1,
        price: item.price || menuItem.price,
        modifiers: item.modifiers || [],
        notes: item.notes || '',
        status: 'pending',
      });
    }
  }

  const branch = await Branch.findById(order.branch);
  if (branch) order.taxRate = branch.taxRate || 0;

  await recalcTotals(order);
  await order.save();

  if (order.table) {
    await Table.findByIdAndUpdate(order.table, {
      status: 'occupied',
      currentOrder: order._id,
    });
  }

  return Order.findById(order._id)
    .populate('table', 'number section')
    .populate('waiter', 'fullName')
    .populate('items.menuItem', 'name price');
};

const addItem = async (orderId, itemData) => {
  const order = await Order.findById(orderId);
  if (!order) throw new Error('Order not found');
  if (!['open', 'confirmed'].includes(order.status)) {
    throw new Error('Cannot add items to this order');
  }

  const menuItem = await MenuItem.findById(itemData.menuItem);
  if (!menuItem) throw new Error('Menu item not found');

  const existingItem = order.items.find(
    (i) => i.menuItem.toString() === menuItem._id.toString() && i.status === 'pending'
  );

  if (existingItem) {
    existingItem.quantity += itemData.quantity || 1;
  } else {
    order.items.push({
      menuItem: menuItem._id,
      name: menuItem.name,
      quantity: itemData.quantity || 1,
      price: itemData.price || menuItem.price,
      modifiers: itemData.modifiers || [],
      notes: itemData.notes || '',
      status: 'pending',
    });
  }

  await recalcTotals(order);
  await order.save();

  return Order.findById(order._id)
    .populate('items.menuItem', 'name price')
    .populate('table', 'number section');
};

const updateOrderItem = async (orderId, itemId, data) => {
  const order = await Order.findById(orderId);
  if (!order) throw new Error('Order not found');

  const item = order.items.id(itemId);
  if (!item) throw new Error('Item not found in order');
  if (item.status !== 'pending') {
    throw new Error('Can only edit pending items');
  }

  if (data.quantity !== undefined) item.quantity = data.quantity;
  if (data.notes !== undefined) item.notes = data.notes;
  if (data.modifiers !== undefined) item.modifiers = data.modifiers;

  await recalcTotals(order);
  await order.save();

  return Order.findById(order._id)
    .populate('items.menuItem', 'name price')
    .populate('table', 'number section');
};

const removeOrderItem = async (orderId, itemId) => {
  const order = await Order.findById(orderId);
  if (!order) throw new Error('Order not found');

  const item = order.items.id(itemId);
  if (!item) throw new Error('Item not found in order');

  order.items.pull(itemId);

  if (order.items.length === 0 && order.table) {
    await Table.findByIdAndUpdate(order.table, {
      status: 'available',
      currentOrder: null,
    });
    await Order.findByIdAndDelete(orderId);
    return null;
  }

  await recalcTotals(order);
  await order.save();

  return Order.findById(order._id)
    .populate('items.menuItem', 'name price')
    .populate('table', 'number section');
};

const applyDiscount = async (orderId, discountType, discountValue) => {
  const order = await Order.findById(orderId);
  if (!order) throw new Error('Order not found');

  if (discountType && !['percentage', 'fixed'].includes(discountType)) {
    throw new Error('Discount type must be "percentage" or "fixed"');
  }

  order.discountType = discountType || null;
  order.discountValue = discountValue || 0;

  await recalcTotals(order);
  await order.save();

  return order;
};

const updateNotes = async (orderId, notes) => {
  return Order.findByIdAndUpdate(orderId, { notes }, { new: true });
};

const updateStatus = async (orderId, status) => {
  const order = await Order.findById(orderId);
  if (!order) throw new Error('Order not found');

  const validTransitions = {
    open: ['confirmed', 'cancelled'],
    confirmed: ['preparing', 'cancelled'],
    preparing: ['ready'],
    ready: ['served'],
    served: ['closed'],
    closed: [],
    cancelled: [],
  };

  if (!validTransitions[order.status] || !validTransitions[order.status].includes(status)) {
    throw new Error(`Cannot transition from "${order.status}" to "${status}"`);
  }

  order.status = status;

  if (status === 'closed' || status === 'cancelled') {
    order.closedAt = new Date();
    if (order.table) {
      await Table.findByIdAndUpdate(order.table, {
        status: 'available',
        currentOrder: null,
      });
    }
  }

  await order.save();
  return order;
};

const processPayment = async (orderId, paymentMethod, paidAmount) => {
  const order = await Order.findById(orderId);
  if (!order) throw new Error('Order not found');
  if (order.paymentStatus === 'paid') {
    throw new Error('Order is already paid');
  }

  order.paymentMethod = paymentMethod;
  order.paidAmount = paidAmount || order.total;
  order.paymentStatus = order.paidAmount >= order.total ? 'paid' : 'partial';

  if (order.paymentStatus === 'paid' && order.status !== 'closed') {
    order.status = 'closed';
    order.closedAt = new Date();
    if (order.table) {
      await Table.findByIdAndUpdate(order.table, {
        status: 'available',
        currentOrder: null,
      });
    }
  }

  await order.save();
  return order;
};

const splitPayment = async (orderId, payments) => {
  const order = await Order.findById(orderId);
  if (!order) throw new Error('Order not found');
  if (order.paymentStatus === 'paid') {
    throw new Error('Order is already paid');
  }

  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);

  if (totalPaid < order.total) {
    throw new Error(`Total paid (${totalPaid}) is less than order total (${order.total})`);
  }

  const validMethods = ['cash', 'card', 'orange_money', 'mtn_money'];
  for (const p of payments) {
    if (!validMethods.includes(p.method)) {
      throw new Error(`Invalid payment method: ${p.method}`);
    }
  }

  order.payments = payments;
  order.paymentMethod = payments[0].method;
  order.paidAmount = totalPaid;
  order.paymentStatus = 'paid';
  order.status = 'closed';
  order.closedAt = new Date();

  if (order.table) {
    await Table.findByIdAndUpdate(order.table, {
      status: 'available',
      currentOrder: null,
    });
  }

  await order.save();
  return order;
};

const getReceiptData = async (orderId) => {
  const order = await Order.findById(orderId)
    .populate('table', 'number section')
    .populate('waiter', 'fullName')
    .populate('cashier', 'fullName')
    .populate('branch', 'name address phone currency');

  if (!order) throw new Error('Order not found');

  const items = order.items
    .filter((i) => i.status !== 'cancelled')
    .map((i) => {
      const modifierTotal = (i.modifiers || []).reduce((s, m) => s + (m.price || 0), 0);
      return {
        name: i.name,
        quantity: i.quantity,
        unitPrice: i.price,
        modifiers: i.modifiers || [],
        modifierTotal,
        lineTotal: (i.price + modifierTotal) * i.quantity,
        notes: i.notes,
      };
    });

  return {
    orderNumber: order.orderNumber,
    table: order.table ? order.table.number : null,
    tableSection: order.table ? order.table.section : null,
    waiter: order.waiter ? order.waiter.fullName : null,
    cashier: order.cashier ? order.cashier.fullName : null,
    branch: order.branch
      ? { name: order.branch.name, address: order.branch.address, phone: order.branch.phone }
      : null,
    currency: order.branch ? order.branch.currency : 'FCFA',
    items,
    subtotal: order.subtotal,
    discountType: order.discountType,
    discountValue: order.discountValue,
    discountAmount: order.discountAmount,
    taxRate: order.taxRate,
    taxAmount: order.taxAmount,
    total: order.total,
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    payments: order.payments || [],
    paidAmount: order.paidAmount || order.total,
    status: order.status,
    createdAt: order.createdAt,
    closedAt: order.closedAt,
  };
};

const cancelOrder = async (orderId, reason, userId) => {
  if (!reason || !reason.trim()) {
    throw new Error('Cancel reason is required');
  }

  const order = await Order.findById(orderId);
  if (!order) throw new Error('Order not found');

  if (['closed', 'cancelled'].includes(order.status)) {
    throw new Error(`Cannot cancel an order with status "${order.status}"`);
  }

  if (order.paymentStatus === 'paid') {
    throw new Error('Cannot cancel a paid order. Use void or refund instead.');
  }

  order.status = 'cancelled';
  order.cancelReason = reason.trim();
  order.cancelledBy = userId;
  order.cancelledAt = new Date();
  order.closedAt = new Date();

  if (order.table) {
    await Table.findByIdAndUpdate(order.table, {
      status: 'available',
      currentOrder: null,
    });
  }

  await order.save();
  return Order.findById(order._id)
    .populate('table', 'number section')
    .populate('waiter', 'fullName')
    .populate('cancelledBy', 'fullName')
    .populate('items.menuItem', 'name price');
};

const voidOrder = async (orderId, reason, userId) => {
  if (!reason || !reason.trim()) {
    throw new Error('Void reason is required');
  }

  const order = await Order.findById(orderId);
  if (!order) throw new Error('Order not found');

  if (order.status === 'cancelled') {
    throw new Error('Order is already cancelled');
  }

  order.status = 'cancelled';
  order.cancelReason = `[VOID] ${reason.trim()}`;
  order.cancelledBy = userId;
  order.cancelledAt = new Date();
  order.closedAt = order.closedAt || new Date();

  if (order.paymentStatus === 'paid') {
    order.paymentStatus = 'refunded';
  }

  if (order.table) {
    await Table.findByIdAndUpdate(order.table, {
      status: 'available',
      currentOrder: null,
    });
  }

  await order.save();
  return Order.findById(order._id)
    .populate('table', 'number section')
    .populate('waiter', 'fullName')
    .populate('cancelledBy', 'fullName')
    .populate('items.menuItem', 'name price');
};

const processRefund = async (orderId, { amount, reason, method }, userId) => {
  if (!amount || amount <= 0) {
    throw new Error('Refund amount must be greater than 0');
  }
  if (!reason || !reason.trim()) {
    throw new Error('Refund reason is required');
  }
  if (!['cash', 'card', 'orange_money', 'mtn_money'].includes(method)) {
    throw new Error('Invalid refund method');
  }

  const order = await Order.findById(orderId);
  if (!order) throw new Error('Order not found');

  if (order.paymentStatus !== 'paid' && order.paymentStatus !== 'partial') {
    throw new Error(`Cannot refund an order with payment status "${order.paymentStatus}"`);
  }

  const totalRefunded = (order.refunds || []).reduce((sum, r) => sum + r.amount, 0);
  const remaining = order.total - totalRefunded;

  if (amount > remaining) {
    throw new Error(`Refund amount (${amount}) exceeds remaining refundable amount (${remaining})`);
  }

  order.refunds.push({
    amount,
    reason: reason.trim(),
    method,
    processedBy: userId,
    createdAt: new Date(),
  });

  const newTotalRefunded = totalRefunded + amount;
  if (newTotalRefunded >= order.total) {
    order.paymentStatus = 'refunded';
  } else {
    order.paymentStatus = 'partial';
  }

  if (order.status !== 'cancelled') {
    order.status = 'closed';
    order.closedAt = order.closedAt || new Date();
  }

  await order.save();
  return Order.findById(order._id)
    .populate('table', 'number section')
    .populate('waiter', 'fullName')
    .populate('cancelledBy', 'fullName')
    .populate('refunds.processedBy', 'fullName')
    .populate('items.menuItem', 'name price');
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
