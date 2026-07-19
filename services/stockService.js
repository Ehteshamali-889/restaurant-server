const StockItem = require('../models/StockItem');
const StockHistory = require('../models/StockHistory');
const PurchaseOrder = require('../models/PurchaseOrder');

const getStockItems = async (filters = {}) => {
  const query = {};
  if (filters.branch) query.branch = filters.branch;
  if (filters.category) query.category = filters.category;
  if (filters.lowStock) {
    query.$expr = { $lte: ['$quantity', '$reorderLevel'] };
    query.reorderLevel = { $gt: 0 };
  }
  if (filters.outOfStock) {
    query.quantity = 0;
  }
  if (filters.search) {
    query.$or = [
      { name: { $regex: filters.search, $options: 'i' } },
    ];
  }
  return StockItem.find(query)
    .populate('supplier', 'name contactPerson phone')
    .sort({ name: 1 });
};

const getStockItemById = async (id) => {
  return StockItem.findById(id).populate('supplier', 'name contactPerson phone email');
};

const createStockItem = async (data) => {
  return StockItem.create(data);
};

const updateStockItem = async (id, data) => {
  return StockItem.findByIdAndUpdate(id, data, { new: true, runValidators: true })
    .populate('supplier', 'name contactPerson phone');
};

const deleteStockItem = async (id) => {
  return StockItem.findByIdAndDelete(id);
};

const adjustStock = async (id, { quantityChange, type, reason, performedBy, branch }) => {
  const item = await StockItem.findById(id);
  if (!item) throw new Error('Stock item not found');

  const quantityBefore = item.quantity;
  const newQuantity = Math.max(0, quantityBefore + quantityChange);

  const history = await StockHistory.create({
    stockItem: id,
    type,
    quantityBefore,
    quantityChange,
    quantityAfter: newQuantity,
    reason,
    performedBy,
    branch: branch || item.branch,
  });

  item.quantity = newQuantity;
  await item.save();

  return { item: await item.populate('supplier', 'name contactPerson phone'), history };
};

const getStockHistory = async (filters = {}) => {
  const query = {};
  if (filters.stockItem) query.stockItem = filters.stockItem;
  if (filters.branch) query.branch = filters.branch;
  if (filters.type) query.type = filters.type;
  if (filters.startDate || filters.endDate) {
    query.createdAt = {};
    if (filters.startDate) query.createdAt.$gte = new Date(filters.startDate);
    if (filters.endDate) query.createdAt.$lte = new Date(filters.endDate);
  }

  const page = parseInt(filters.page) || 1;
  const limit = parseInt(filters.limit) || 20;
  const skip = (page - 1) * limit;

  const [history, total] = await Promise.all([
    StockHistory.find(query)
      .populate('stockItem', 'name unit')
      .populate('performedBy', 'fullName')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    StockHistory.countDocuments(query),
  ]);

  return {
    data: history,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
};

const getInventoryDashboard = async (branchId) => {
  const filter = {};
  if (branchId) filter.branch = branchId;

  const [
    totalItems,
    lowStockItems,
    outOfStockItems,
    totalSuppliers,
    recentHistory,
    categoryStats,
  ] = await Promise.all([
    StockItem.countDocuments(filter),
    StockItem.find({
      $expr: { $lte: ['$quantity', '$reorderLevel'] },
      reorderLevel: { $gt: 0 },
      ...(branchId && { branch: branchId }),
    })
      .populate('supplier', 'name')
      .select('name quantity unit reorderLevel category supplier')
      .sort({ quantity: 1 }),
    StockItem.countDocuments({ ...filter, quantity: 0 }),
    require('../models/Supplier').countDocuments({ ...(branchId && { branch: branchId }), isActive: true }),
    StockHistory.find({ ...(branchId && { branch: branchId }) })
      .populate('stockItem', 'name unit')
      .populate('performedBy', 'fullName')
      .sort({ createdAt: -1 })
      .limit(10),
    StockItem.aggregate([
      ...(branchId ? [{ $match: { branch: branchId } }] : []),
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
          totalValue: { $sum: { $multiply: ['$quantity', '$costPerUnit'] } },
          totalQuantity: { $sum: '$quantity' },
        },
      },
      { $sort: { totalValue: -1 } },
    ]),
  ]);

  const stockValue = await StockItem.aggregate([
    ...(branchId ? [{ $match: { branch: branchId } }] : []),
    {
      $group: {
        _id: null,
        totalValue: { $sum: { $multiply: ['$quantity', '$costPerUnit'] } },
      },
    },
  ]);

  return {
    totalItems,
    lowStockItems,
    outOfStockItems,
    totalSuppliers,
    recentHistory,
    categoryStats,
    totalStockValue: stockValue[0]?.totalValue || 0,
  };
};

const createPurchaseOrder = async (data) => {
  const po = await PurchaseOrder.create(data);
  return po.populate('supplier', 'name contactPerson phone');
};

const getPurchaseOrders = async (filters = {}) => {
  const query = {};
  if (filters.branch) query.branch = filters.branch;
  if (filters.status) query.status = filters.status;
  if (filters.supplier) query.supplier = filters.supplier;

  const page = parseInt(filters.page) || 1;
  const limit = parseInt(filters.limit) || 20;
  const skip = (page - 1) * limit;

  const [orders, total] = await Promise.all([
    PurchaseOrder.find(query)
      .populate('supplier', 'name contactPerson phone')
      .populate('createdBy', 'fullName')
      .populate('items.stockItem', 'name unit')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    PurchaseOrder.countDocuments(query),
  ]);

  return {
    data: orders,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
};

const getPurchaseOrderById = async (id) => {
  return PurchaseOrder.findById(id)
    .populate('supplier', 'name contactPerson phone email address')
    .populate('createdBy', 'fullName')
    .populate('items.stockItem', 'name unit quantity');
};

const updatePurchaseOrder = async (id, data) => {
  return PurchaseOrder.findByIdAndUpdate(id, data, { new: true, runValidators: true })
    .populate('supplier', 'name contactPerson phone')
    .populate('items.stockItem', 'name unit');
};

const receivePurchaseOrder = async (id, userId) => {
  const po = await PurchaseOrder.findById(id).populate('items.stockItem', 'name unit');
  if (!po) throw new Error('Purchase order not found');
  if (po.status === 'received') throw new Error('Purchase order already received');
  if (po.status === 'cancelled') throw new Error('Cannot receive a cancelled purchase order');

  for (const item of po.items) {
    if (item.stockItem) {
      await adjustStock(item.stockItem._id, {
        quantityChange: item.quantity,
        type: 'purchase',
        reason: `Reception bon de commande ${po.orderNumber}`,
        performedBy: userId,
        branch: po.branch,
      });
    }
  }

  po.status = 'received';
  po.receivedDate = new Date();
  await po.save();

  return po.populate('supplier', 'name contactPerson phone');
};

const cancelPurchaseOrder = async (id) => {
  const po = await PurchaseOrder.findById(id);
  if (!po) throw new Error('Purchase order not found');
  if (po.status === 'received') throw new Error('Cannot cancel a received purchase order');
  if (po.status === 'cancelled') throw new Error('Purchase order already cancelled');

  po.status = 'cancelled';
  await po.save();

  return po.populate('supplier', 'name contactPerson phone');
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
