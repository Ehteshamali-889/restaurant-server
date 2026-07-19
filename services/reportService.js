const Order = require('../models/Order');
const StockItem = require('../models/StockItem');
const StockHistory = require('../models/StockHistory');
const Reservation = require('../models/Reservation');
const User = require('../models/User');
const Expense = require('../models/Expense');
const Payroll = require('../models/Payroll');
const Branch = require('../models/Branch');

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

const getProfitabilityReport = async (filters = {}) => {
  const { start, end } = parseDateRange(filters.startDate, filters.endDate);
  const branchFilter = filters.branch ? { branch: filters.branch } : {};

  const orderMatch = {
    createdAt: { $gte: start, $lt: end },
    status: { $nin: ['cancelled'] },
    ...branchFilter,
  };

  const expenseMatch = {
    date: { $gte: start, $lt: end },
    ...branchFilter,
  };

  const payrollMatch = {
    createdAt: { $gte: start, $lt: end },
    ...branchFilter,
  };

  const [revenueSummary, expenseByCategory, totalExpenses, totalPayroll, branchRevenue] = await Promise.all([
    Order.aggregate([
      { $match: orderMatch },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$total' },
          totalTax: { $sum: '$taxAmount' },
          totalDiscounts: { $sum: '$discountAmount' },
          totalOrders: { $sum: 1 },
          avgOrderValue: { $avg: '$total' },
        },
      },
    ]),
    Expense.aggregate([
      { $match: expenseMatch },
      {
        $group: {
          _id: '$category',
          total: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
      { $sort: { total: -1 } },
    ]),
    Expense.aggregate([
      { $match: expenseMatch },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
    Payroll.aggregate([
      { $match: payrollMatch },
      { $group: { _id: null, total: { $sum: '$netPay' }, count: { $sum: 1 } } },
    ]),
    Order.aggregate([
      { $match: orderMatch },
      ...(filters.branch ? [] : [{ $lookup: { from: 'branches', localField: 'branch', foreignField: '_id', as: 'branchInfo' } }]),
      ...(filters.branch ? [] : [{ $unwind: { path: '$branchInfo', preserveNullAndEmptyArrays: true } }]),
      {
        $group: {
          _id: filters.branch ? filters.branch : { id: '$branch', name: { $first: '$branchInfo.name' } },
          revenue: { $sum: '$total' },
          orders: { $sum: 1 },
        },
      },
      { $sort: { revenue: -1 } },
    ]),
  ]);

  const rev = revenueSummary[0] || { totalRevenue: 0, totalTax: 0, totalDiscounts: 0, totalOrders: 0, avgOrderValue: 0 };
  const exp = totalExpenses[0]?.total || 0;
  const pay = totalPayroll[0]?.total || 0;
  const totalCosts = exp + pay;
  const grossProfit = rev.totalRevenue - exp;
  const netProfit = rev.totalRevenue - totalCosts;

  const expenseLabels = {
    rent: 'Loyer', utilities: 'Services publics', ingredients: 'Ingredients',
    salaries: 'Salaires', maintenance: 'Maintenance', marketing: 'Marketing',
    insurance: 'Assurance', supplies: 'Fournitures', taxes: 'Impots', other: 'Autres',
  };

  const costBreakdown = [
    ...expenseByCategory.map((e) => ({
      category: e._id,
      label: expenseLabels[e._id] || e._id,
      amount: e.total,
      percentage: rev.totalRevenue > 0 ? Math.round((e.total / rev.totalRevenue) * 10000) / 100 : 0,
      count: e.count,
    })),
    {
      category: 'payroll',
      label: 'Masse salariale',
      amount: pay,
      percentage: rev.totalRevenue > 0 ? Math.round((pay / rev.totalRevenue) * 10000) / 100 : 0,
      count: totalPayroll[0]?.count || 0,
    },
  ];

  const branchData = branchRevenue.map((b) => {
    if (filters.branch) {
      return { branchId: b._id, branchName: 'Succursale unique', revenue: b.revenue, orders: b.orders };
    }
    return { branchId: b._id?.id || b._id, branchName: b._id?.name || 'Inconnu', revenue: b.revenue, orders: b.orders };
  });

  return {
    period: { start, end },
    summary: {
      totalRevenue: rev.totalRevenue,
      totalExpenses: exp,
      totalPayroll: pay,
      totalCosts,
      grossProfit,
      netProfit,
      grossMargin: rev.totalRevenue > 0 ? Math.round((grossProfit / rev.totalRevenue) * 10000) / 100 : 0,
      netMargin: rev.totalRevenue > 0 ? Math.round((netProfit / rev.totalRevenue) * 10000) / 100 : 0,
      totalOrders: rev.totalOrders,
      avgOrderValue: Math.round(rev.avgOrderValue * 100) / 100,
      totalTax: rev.totalTax,
      totalDiscounts: rev.totalDiscounts,
    },
    costBreakdown,
    branchPerformance: branchData,
  };
};

const getPayrollSummary = async (filters = {}) => {
  const { start, end } = parseDateRange(filters.startDate, filters.endDate);
  const branchFilter = filters.branch ? { branch: filters.branch } : {};

  const matchFilter = {
    createdAt: { $gte: start, $lt: end },
    ...branchFilter,
  };

  const [payrollByEmployee, statusBreakdown, totalStats, byBranch] = await Promise.all([
    Payroll.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: '$employee',
          totalNetPay: { $sum: '$netPay' },
          totalBaseSalary: { $sum: '$baseSalary' },
          totalBonuses: { $sum: '$bonuses' },
          totalDeductions: { $sum: '$deductions' },
          totalTax: { $sum: '$taxAmount' },
          totalOvertime: { $sum: '$overtimeHours' },
          monthsCount: { $sum: 1 },
          avgNetPay: { $avg: '$netPay' },
        },
      },
      { $sort: { totalNetPay: -1 } },
    ]),
    Payroll.aggregate([
      { $match: matchFilter },
      { $group: { _id: '$status', count: { $sum: 1 }, total: { $sum: '$netPay' } } },
    ]),
    Payroll.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: null,
          totalNetPay: { $sum: '$netPay' },
          totalBaseSalary: { $sum: '$baseSalary' },
          totalBonuses: { $sum: '$bonuses' },
          totalDeductions: { $sum: '$deductions' },
          totalTax: { $sum: '$taxAmount' },
          employeeCount: { $addToSet: '$employee' },
        },
      },
    ]),
    Order.aggregate([
      { $match: { createdAt: { $gte: start, $lt: end }, status: { $nin: ['cancelled'] } } },
      ...(filters.branch ? [] : [{ $lookup: { from: 'branches', localField: 'branch', foreignField: '_id', as: 'branchInfo' } }]),
      ...(filters.branch ? [] : [{ $unwind: { path: '$branchInfo', preserveNullAndEmptyArrays: true } }]),
      {
        $group: {
          _id: filters.branch ? filters.branch : { id: '$branch', name: { $first: '$branchInfo.name' } },
          revenue: { $sum: '$total' },
        },
      },
    ]),
  ]);

  const employeeIds = payrollByEmployee.map((p) => p._id);
  const employees = await User.find({ _id: { $in: employeeIds } }).select('fullName username role branch');
  const employeeMap = {};
  employees.forEach((e) => { employeeMap[e._id.toString()] = e; });

  const employeeDetails = payrollByEmployee.map((p) => {
    const emp = employeeMap[p._id.toString()];
    return {
      employee: emp ? { id: emp._id, fullName: emp.fullName, username: emp.username, role: emp.role } : { id: p._id, fullName: 'Inconnu', username: '', role: '' },
      totalNetPay: p.totalNetPay,
      totalBaseSalary: p.totalBaseSalary,
      totalBonuses: p.totalBonuses,
      totalDeductions: p.totalDeductions,
      totalTax: p.totalTax,
      totalOvertime: p.totalOvertime,
      monthsCount: p.monthsCount,
      avgNetPay: Math.round(p.avgNetPay * 100) / 100,
    };
  });

  const totals = totalStats[0] || { totalNetPay: 0, totalBaseSalary: 0, totalBonuses: 0, totalDeductions: 0, totalTax: 0, employeeCount: [] };

  const statusLabels = { pending: 'En attente', processed: 'Traite', paid: 'Paye' };
  const statusData = statusBreakdown.map((s) => ({
    status: s._id,
    label: statusLabels[s._id] || s._id,
    count: s.count,
    total: s.total,
  }));

  const revenue = byBranch[0]?.revenue || 0;
  const payrollRatio = revenue > 0 ? Math.round((totals.totalNetPay / revenue) * 10000) / 100 : 0;

  return {
    period: { start, end },
    summary: {
      totalNetPay: totals.totalNetPay,
      totalBaseSalary: totals.totalBaseSalary,
      totalBonuses: totals.totalBonuses,
      totalDeductions: totals.totalDeductions,
      totalTax: totals.totalTax,
      activeEmployees: totals.employeeCount.length,
      payrollToRevenueRatio: payrollRatio,
    },
    employees: employeeDetails,
    statusBreakdown: statusData,
  };
};

const getSalesTrends = async (filters = {}) => {
  const branchFilter = filters.branch ? { branch: filters.branch } : {};

  const matchFilter = {
    status: { $nin: ['cancelled'] },
    ...branchFilter,
  };

  const now = new Date();

  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

  const currentWeekStart = new Date(now);
  currentWeekStart.setDate(now.getDate() - now.getDay());
  currentWeekStart.setHours(0, 0, 0, 0);

  const [monthlyTrends, weeklyTrends, peakHours, peakDays, hourlyHeatmap, currentMonthRevenue, prevMonthRevenue] = await Promise.all([
    Order.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
          revenue: { $sum: '$total' },
          orders: { $sum: 1 },
          avgOrder: { $avg: '$total' },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]),
    Order.aggregate([
      { $match: { ...matchFilter, createdAt: { $gte: new Date(now.getTime() - 12 * 7 * 24 * 60 * 60 * 1000) } } },
      {
        $group: {
          _id: { year: { $year: '$createdAt' }, week: { $week: '$createdAt' }, dayOfWeek: { $dayOfWeek: '$createdAt' } },
          revenue: { $sum: '$total' },
          orders: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1, '_id.week': 1, '_id.dayOfWeek': 1 } },
    ]),
    Order.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: { hour: { $hour: '$createdAt' }, dayOfWeek: { $dayOfWeek: '$createdAt' } },
          revenue: { $sum: '$total' },
          orders: { $sum: 1 },
        },
      },
      { $sort: { '_id.dayOfWeek': 1, '_id.hour': 1 } },
    ]),
    Order.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: { $dayOfWeek: '$createdAt' },
          revenue: { $sum: '$total' },
          orders: { $sum: 1 },
          avgOrder: { $avg: '$total' },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    Order.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: { hour: { $hour: '$createdAt' }, dayOfWeek: { $dayOfWeek: '$createdAt' } },
          revenue: { $sum: '$total' },
          orders: { $sum: 1 },
        },
      },
    ]),
    Order.aggregate([
      { $match: { ...matchFilter, createdAt: { $gte: currentMonthStart, $lte: currentMonthEnd } } },
      { $group: { _id: null, revenue: { $sum: '$total' }, orders: { $sum: 1 } } },
    ]),
    Order.aggregate([
      { $match: { ...matchFilter, createdAt: { $gte: prevMonthStart, $lte: prevMonthEnd } } },
      { $group: { _id: null, revenue: { $sum: '$total' }, orders: { $sum: 1 } } },
    ]),
  ]);

  const monthNames = ['Jan', 'Fev', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aou', 'Sep', 'Oct', 'Nov', 'Dec'];
  const dayNames = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

  const monthlyData = monthlyTrends.map((m) => ({
    label: `${monthNames[m._id.month - 1]} ${m._id.year}`,
    month: m._id.month,
    year: m._id.year,
    revenue: m.revenue,
    orders: m.orders,
    avgOrder: Math.round(m.avgOrder * 100) / 100,
  }));

  const dailyData = peakDays.map((d) => ({
    day: dayNames[d._id - 1] || `Jour ${d._id}`,
    dayIndex: d._id,
    revenue: d.revenue,
    orders: d.orders,
    avgOrder: Math.round(d.avgOrder * 100) / 100,
  }));

  const heatMapData = [];
  for (let day = 1; day <= 7; day++) {
    for (let hour = 0; hour < 24; hour++) {
      const match = hourlyHeatmap.find((h) => h._id.dayOfWeek === day && h._id.hour === hour);
      heatMapData.push({
        day: dayNames[day - 1],
        dayIndex: day,
        hour,
        label: `${String(hour).padStart(2, '0')}h`,
        revenue: match ? match.revenue : 0,
        orders: match ? match.orders : 0,
      });
    }
  }

  const currentRev = currentMonthRevenue[0]?.revenue || 0;
  const prevRev = prevMonthRevenue[0]?.revenue || 0;
  const currentOrders = currentMonthRevenue[0]?.orders || 0;
  const prevOrders = prevMonthRevenue[0]?.orders || 0;

  const revenueGrowth = prevRev > 0 ? Math.round(((currentRev - prevRev) / prevRev) * 10000) / 100 : currentRev > 0 ? 100 : 0;
  const orderGrowth = prevOrders > 0 ? Math.round(((currentOrders - prevOrders) / prevOrders) * 10000) / 100 : currentOrders > 0 ? 100 : 0;

  const bestDay = dailyData.reduce((best, d) => d.revenue > (best?.revenue || 0) ? d : best, null);
  const worstDay = dailyData.reduce((worst, d) => d.revenue < (worst?.revenue || Infinity) ? d : worst, null);

  const peakHourData = peakHours
    .reduce((acc, h) => {
      const existing = acc.find((a) => a.hour === h._id.hour);
      if (existing) {
        existing.revenue += h.revenue;
        existing.orders += h.orders;
      } else {
        acc.push({ hour: h._id.hour, revenue: h.revenue, orders: h.orders });
      }
      return acc;
    }, [])
    .sort((a, b) => b.orders - a.orders)
    .slice(0, 5);

  return {
    summary: {
      currentMonthRevenue: currentRev,
      previousMonthRevenue: prevRev,
      revenueGrowth,
      currentMonthOrders: currentOrders,
      previousMonthOrders: prevOrders,
      orderGrowth,
      bestDay: bestDay ? bestDay.day : '-',
      worstDay: worstDay ? worstDay.day : '-',
    },
    monthlyTrends: monthlyData,
    peakDays: dailyData,
    peakHours: peakHourData.map((h) => ({ hour: `${String(h.hour).padStart(2, '0')}h`, revenue: h.revenue, orders: h.orders })),
    heatmap: heatMapData,
  };
};

module.exports = {
  getDailySalesReport,
  getPaymentSummary,
  getWaiterPerformance,
  getInventoryReport,
  getRevenueReport,
  getReservationReport,
  getProfitabilityReport,
  getPayrollSummary,
  getSalesTrends,
};
