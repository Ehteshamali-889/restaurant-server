const Order = require('../models/Order');
const StockItem = require('../models/StockItem');
const StockHistory = require('../models/StockHistory');
const Reservation = require('../models/Reservation');
const User = require('../models/User');

const parseDateRange = (startDate, endDate) => {
  const start = startDate ? new Date(startDate) : new Date();
  start.setHours(0, 0, 0, 0);
  const end = endDate ? new Date(endDate) : new Date(start);
  if (!endDate) end.setDate(end.getDate() + 1);
  else end.setHours(23, 59, 59, 999);
  return { start, end };
};

const getDailySalesReport = async (filters = {}) => {
  const { start, end } = parseDateRange(filters.startDate, filters.endDate);
  const branchFilter = filters.branch ? { branch: filters.branch } : {};

  const matchFilter = {
    createdAt: { $gte: start, $lt: end },
    status: { $nin: ['cancelled'] },
    ...branchFilter,
  };

  const [summaryResult, topItems, ordersByHour] = await Promise.all([
    Order.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: null,
          totalSales: { $sum: '$total' },
          totalOrders: { $sum: 1 },
          avgOrderValue: { $avg: '$total' },
          totalDiscounts: { $sum: '$discountAmount' },
          totalTax: { $sum: '$taxAmount' },
        },
      },
    ]),
    Order.aggregate([
      { $match: matchFilter },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.name',
          menuItem: { $first: '$items.menuItem' },
          totalQuantity: { $sum: '$items.quantity' },
          totalRevenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
        },
      },
      { $sort: { totalQuantity: -1 } },
      { $limit: 10 },
    ]),
    Order.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: { $hour: '$createdAt' },
          orderCount: { $sum: 1 },
          totalSales: { $sum: '$total' },
        },
      },
      { $sort: { _id: 1 } },
    ]),
  ]);

  const summary = summaryResult[0] || {
    totalSales: 0,
    totalOrders: 0,
    avgOrderValue: 0,
    totalDiscounts: 0,
    totalTax: 0,
  };

  return {
    period: { start, end },
    summary: {
      totalSales: summary.totalSales,
      totalOrders: summary.totalOrders,
      avgOrderValue: Math.round(summary.avgOrderValue * 100) / 100,
      totalDiscounts: summary.totalDiscounts,
      totalTax: summary.totalTax,
    },
    topItems,
    ordersByHour,
  };
};

const getPaymentSummary = async (filters = {}) => {
  const { start, end } = parseDateRange(filters.startDate, filters.endDate);
  const branchFilter = filters.branch ? { branch: filters.branch } : {};

  const matchFilter = {
    createdAt: { $gte: start, $lt: end },
    status: { $nin: ['cancelled'] },
    paymentStatus: { $in: ['paid', 'partial'] },
    ...branchFilter,
  };

  const [byMethod, byMethodCount, refundTotal] = await Promise.all([
    Order.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: '$paymentMethod',
          totalAmount: { $sum: '$paidAmount' },
          count: { $sum: 1 },
        },
      },
    ]),
    Order.aggregate([
      { $match: matchFilter },
      { $unwind: '$payments' },
      {
        $group: {
          _id: '$payments.method',
          totalAmount: { $sum: '$payments.amount' },
          count: { $sum: 1 },
        },
      },
    ]),
    Order.aggregate([
      {
        $match: {
          createdAt: { $gte: start, $lt: end },
          status: { $nin: ['cancelled'] },
          'refunds.0': { $exists: true },
          ...branchFilter,
        },
      },
      { $unwind: '$refunds' },
      {
        $group: {
          _id: '$refunds.method',
          totalRefunded: { $sum: '$refunds.amount' },
          count: { $sum: 1 },
        },
      },
    ]),
  ]);

  const methodLabels = {
    cash: 'Especes',
    card: 'Carte bancaire',
    orange_money: 'Orange Money',
    mtn_money: 'MTN Money',
  };

  const breakdown = ['cash', 'card', 'orange_money', 'mtn_money'].map((method) => {
    const agg = byMethod.find((a) => a._id === method) || { totalAmount: 0, count: 0 };
    const splitPay = byMethodCount.filter((a) => a._id === method);
    const splitAmount = splitPay.reduce((sum, s) => sum + s.totalAmount, 0);
    const refunds = refundTotal.find((r) => r._id === method) || { totalRefunded: 0, count: 0 };
    return {
      method,
      label: methodLabels[method],
      totalAmount: agg.totalAmount,
      orderCount: agg.count,
      splitPaymentAmount: splitAmount,
      refundsTotal: refunds.totalRefunded,
      refundCount: refunds.count,
      netAmount: agg.totalAmount - refunds.totalRefunded,
    };
  });

  const grandTotal = breakdown.reduce((sum, b) => sum + b.netAmount, 0);

  return {
    period: { start, end },
    breakdown,
    grandTotal,
  };
};

const getWaiterPerformance = async (filters = {}) => {
  const { start, end } = parseDateRange(filters.startDate, filters.endDate);
  const branchFilter = filters.branch ? { branch: filters.branch } : {};

  const matchFilter = {
    createdAt: { $gte: start, $lt: end },
    status: { $nin: ['cancelled'] },
    waiter: { $ne: null },
    ...branchFilter,
  };

  const performance = await Order.aggregate([
    { $match: matchFilter },
    {
      $group: {
        _id: '$waiter',
        totalOrders: { $sum: 1 },
        totalRevenue: { $sum: '$total' },
        avgOrderValue: { $avg: '$total' },
        avgHandleTime: {
          $avg: {
            $cond: [
              { $ne: ['$closedAt', null] },
              { $subtract: ['$closedAt', '$createdAt'] },
              null,
            ],
          },
        },
        itemsServed: { $sum: { $sum: '$items.quantity' } },
      },
    },
    { $sort: { totalRevenue: -1 } },
  ]);

  const waiterIds = performance.map((p) => p._id);
  const waiters = await User.find({ _id: { $in: waiterIds } })
    .select('fullName username role');

  const waiterMap = {};
  waiters.forEach((w) => { waiterMap[w._id.toString()] = w; });

  const results = performance.map((p) => {
    const waiter = waiterMap[p._id.toString()];
    const avgMinutes = p.avgHandleTime ? Math.round(p.avgHandleTime / 60000) : 0;
    return {
      waiter: waiter ? { id: waiter._id, fullName: waiter.fullName, username: waiter.username } : { id: p._id, fullName: 'Inconnu', username: '' },
      totalOrders: p.totalOrders,
      totalRevenue: p.totalRevenue,
      avgOrderValue: Math.round(p.avgOrderValue * 100) / 100,
      avgHandleTimeMinutes: avgMinutes,
      itemsServed: p.itemsServed,
    };
  });

  return {
    period: { start, end },
    waiters: results,
    totals: {
      totalOrders: results.reduce((s, r) => s + r.totalOrders, 0),
      totalRevenue: results.reduce((s, r) => s + r.totalRevenue, 0),
    },
  };
};

const getInventoryReport = async (filters = {}) => {
  const { start, end } = parseDateRange(filters.startDate, filters.endDate);
  const branchFilter = filters.branch ? { branch: filters.branch } : {};

  const historyMatch = {
    createdAt: { $gte: start, $lt: end },
    ...branchFilter,
  };

  const [
    lowStockItems,
    stockUsage,
    wastageData,
    categoryValue,
    recentHistory,
    outOfStockCount,
    totalStockValue,
  ] = await Promise.all([
    StockItem.find({
      $expr: { $lte: ['$quantity', '$reorderLevel'] },
      reorderLevel: { $gt: 0 },
      ...(filters.branch && { branch: filters.branch }),
    })
      .populate('supplier', 'name')
      .select('name quantity unit reorderLevel category supplier costPerUnit')
      .sort({ quantity: 1 }),

    StockHistory.aggregate([
      { $match: { ...historyMatch, type: 'usage' } },
      {
        $group: {
          _id: '$stockItem',
          totalUsed: { $sum: { $abs: '$quantityChange' } },
          usageCount: { $sum: 1 },
        },
      },
      { $sort: { totalUsed: -1 } },
      { $limit: 20 },
    ]),

    StockHistory.aggregate([
      { $match: { ...historyMatch, type: { $in: ['waste', 'damage'] } } },
      {
        $group: {
          _id: '$type',
          totalQuantity: { $sum: { $abs: '$quantityChange' } },
          count: { $sum: 1 },
        },
      },
    ]),

    StockItem.aggregate([
      ...(filters.branch ? [{ $match: { branch: filters.branch } }] : []),
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

    StockHistory.find(historyMatch)
      .populate('stockItem', 'name unit')
      .populate('performedBy', 'fullName')
      .sort({ createdAt: -1 })
      .limit(20),

    StockItem.countDocuments({
      quantity: 0,
      ...(filters.branch && { branch: filters.branch }),
    }),

    StockItem.aggregate([
      ...(filters.branch ? [{ $match: { branch: filters.branch } }] : []),
      {
        $group: {
          _id: null,
          totalValue: { $sum: { $multiply: ['$quantity', '$costPerUnit'] } },
        },
      },
    ]),
  ]);

  const stockItemIds = stockUsage.map((s) => s._id);
  const stockItems = await StockItem.find({ _id: { $in: stockItemIds } }).select('name unit costPerUnit');
  const stockItemMap = {};
  stockItems.forEach((si) => { stockItemMap[si._id.toString()] = si; });

  const usageWithCost = stockUsage.map((u) => {
    const item = stockItemMap[u._id.toString()];
    return {
      stockItem: item ? { name: item.name, unit: item.unit } : { name: 'Inconnu', unit: '' },
      totalUsed: u.totalUsed,
      usageCount: u.usageCount,
      estimatedCost: item ? Math.round(u.totalUsed * item.costPerUnit * 100) / 100 : 0,
    };
  });

  return {
    period: { start, end },
    summary: {
      totalStockValue: totalStockValue[0]?.totalValue || 0,
      outOfStockCount,
      lowStockCount: lowStockItems.length,
      wastageEvents: wastageData.find((w) => w._id === 'waste')?.count || 0,
      damageEvents: wastageData.find((w) => w._id === 'damage')?.count || 0,
    },
    lowStockItems,
    stockUsage: usageWithCost,
    wastage: wastageData,
    categoryBreakdown: categoryValue,
    recentMovements: recentHistory,
  };
};

const getRevenueReport = async (filters = {}) => {
  const branchFilter = filters.branch ? { branch: filters.branch } : {};
  const granularity = filters.granularity || 'daily';

  const matchFilter = {
    status: { $nin: ['cancelled'] },
    ...branchFilter,
  };

  if (filters.startDate || filters.endDate) {
    const { start, end } = parseDateRange(filters.startDate, filters.endDate);
    matchFilter.createdAt = { $gte: start, $lt: end };
  }

  let groupId;
  let sortStage;
  let dateFormat;

  switch (granularity) {
    case 'hourly':
      groupId = {
        year: { $year: '$createdAt' },
        month: { $month: '$createdAt' },
        day: { $dayOfMonth: '$createdAt' },
        hour: { $hour: '$createdAt' },
      };
      sortStage = { _id: 1 };
      dateFormat = (g) => `${String(g.day).padStart(2, '0')}/${String(g.month).padStart(2, '0')} ${String(g.hour).padStart(2, '0')}h`;
      break;
    case 'weekly':
      groupId = {
        year: { $year: '$createdAt' },
        week: { $week: '$createdAt' },
      };
      sortStage = { _id: 1 };
      dateFormat = (g) => `S${g.week} ${g.year}`;
      break;
    case 'monthly':
      groupId = {
        year: { $year: '$createdAt' },
        month: { $month: '$createdAt' },
      };
      sortStage = { _id: 1 };
      dateFormat = (g) => `${String(g.month).padStart(2, '0')}/${g.year}`;
      break;
    case 'yearly':
      groupId = { year: { $year: '$createdAt' } };
      sortStage = { _id: 1 };
      dateFormat = (g) => `${g.year}`;
      break;
    default: // daily
      groupId = {
        year: { $year: '$createdAt' },
        month: { $month: '$createdAt' },
        day: { $dayOfMonth: '$createdAt' },
      };
      sortStage = { _id: 1 };
      dateFormat = (g) => `${String(g.day).padStart(2, '0')}/${String(g.month).padStart(2, '0')}/${g.year}`;
  }

  const [revenueData, totalSummary] = await Promise.all([
    Order.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: groupId,
          revenue: { $sum: '$total' },
          orders: { $sum: 1 },
          avgOrderValue: { $avg: '$total' },
          tax: { $sum: '$taxAmount' },
        },
      },
      { $sort: sortStage },
    ]),
    Order.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$total' },
          totalOrders: { $sum: 1 },
          avgOrderValue: { $avg: '$total' },
          maxOrder: { $max: '$total' },
          minOrder: { $min: '$total' },
        },
      },
    ]),
  ]);

  const chartData = revenueData.map((d) => ({
    label: dateFormat(d._id),
    revenue: d.revenue,
    orders: d.orders,
    avgOrderValue: Math.round(d.avgOrderValue * 100) / 100,
    tax: d.tax,
  }));

  const summary = totalSummary[0] || {
    totalRevenue: 0,
    totalOrders: 0,
    avgOrderValue: 0,
    maxOrder: 0,
    minOrder: 0,
  };

  return {
    period: { start: matchFilter.createdAt?.$gte, end: matchFilter.createdAt?.$lt },
    granularity,
    summary: {
      totalRevenue: summary.totalRevenue,
      totalOrders: summary.totalOrders,
      avgOrderValue: Math.round(summary.avgOrderValue * 100) / 100,
      maxOrder: summary.maxOrder,
      minOrder: summary.minOrder,
    },
    chartData,
  };
};

const getReservationReport = async (filters = {}) => {
  const { start, end } = parseDateRange(filters.startDate, filters.endDate);
  const branchFilter = filters.branch ? { branch: filters.branch } : {};

  const matchFilter = {
    date: { $gte: start, $lt: end },
    ...branchFilter,
  };

  const [statusBreakdown, peakHours, avgPartySize, totalReservations, noShowDetails] = await Promise.all([
    Reservation.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]),
    Reservation.aggregate([
      { $match: matchFilter },
      {
        $addFields: {
          hour: { $toInt: { $substr: ['$time', 0, 2] } },
        },
      },
      {
        $group: {
          _id: '$hour',
          count: { $sum: 1 },
          avgPartySize: { $avg: '$partySize' },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    Reservation.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: null,
          avgPartySize: { $avg: '$partySize' },
          maxPartySize: { $max: '$partySize' },
          minPartySize: { $min: '$partySize' },
        },
      },
    ]),
    Reservation.countDocuments(matchFilter),
    Reservation.aggregate([
      { $match: { ...matchFilter, status: 'no-show' } },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          totalPartySize: { $sum: '$partySize' },
        },
      },
    ]),
  ]);

  const statuses = ['pending', 'confirmed', 'arrived', 'seated', 'completed', 'cancelled', 'no-show'];
  const statusLabels = {
    pending: 'En attente',
    confirmed: 'Confirme',
    arrived: 'Arrive',
    seated: 'Place',
    completed: 'Termine',
    cancelled: 'Annule',
    'no-show': 'Non presente',
  };

  const statusData = statuses.map((s) => {
    const item = statusBreakdown.find((b) => b._id === s);
    return {
      status: s,
      label: statusLabels[s],
      count: item ? item.count : 0,
      percentage: totalReservations > 0 ? Math.round(((item ? item.count : 0) / totalReservations) * 10000) / 100 : 0,
    };
  });

  const noShowData = noShowDetails[0] || { count: 0, totalPartySize: 0 };
  const partyStats = avgPartySize[0] || { avgPartySize: 0, maxPartySize: 0, minPartySize: 0 };
  const noShowRate = totalReservations > 0 ? Math.round((noShowData.count / totalReservations) * 10000) / 100 : 0;

  return {
    period: { start, end },
    summary: {
      totalReservations,
      noShows: noShowData.count,
      noShowRate,
      avgPartySize: Math.round(partyStats.avgPartySize * 100) / 100,
      maxPartySize: partyStats.maxPartySize,
      minPartySize: partyStats.minPartySize,
    },
    statusBreakdown: statusData,
    peakHours: peakHours.map((h) => ({
      hour: `${String(h._id).padStart(2, '0')}h`,
      count: h.count,
      avgPartySize: Math.round(h.avgPartySize * 100) / 100,
    })),
  };
};

module.exports = {
  getDailySalesReport,
  getPaymentSummary,
  getWaiterPerformance,
  getInventoryReport,
  getRevenueReport,
  getReservationReport,
};
