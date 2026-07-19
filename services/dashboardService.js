const Order = require('../models/Order');
const Table = require('../models/Table');
const StockItem = require('../models/StockItem');

const getDailySummary = async (branchId) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const matchFilter = {
    createdAt: { $gte: today, $lt: tomorrow },
    status: { $nin: ['cancelled'] },
  };

  if (branchId) {
    matchFilter.branch = branchId;
  }

  const [salesResult, ordersCount, openTables, lowStock] = await Promise.all([
    Order.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: null,
          totalSales: { $sum: '$total' },
          totalOrders: { $sum: 1 },
          avgOrderValue: { $avg: '$total' },
          cashTotal: {
            $sum: { $cond: [{ $eq: ['$paymentMethod', 'cash'] }, '$total', 0] },
          },
          cardTotal: {
            $sum: { $cond: [{ $eq: ['$paymentMethod', 'card'] }, '$total', 0] },
          },
          orangeMoneyTotal: {
            $sum: { $cond: [{ $eq: ['$paymentMethod', 'orange_money'] }, '$total', 0] },
          },
          mtnMoneyTotal: {
            $sum: { $cond: [{ $eq: ['$paymentMethod', 'mtn_money'] }, '$total', 0] },
          },
        },
      },
    ]),
    Order.countDocuments(matchFilter),
    Table.countDocuments({
      status: 'occupied',
      ...(branchId && { branch: branchId }),
    }),
    StockItem.find({
      $expr: { $lte: ['$quantity', '$reorderLevel'] },
      reorderLevel: { $gt: 0 },
      ...(branchId && { branch: branchId }),
    })
      .select('name quantity unit reorderLevel')
      .limit(10),
  ]);

  const sales = salesResult[0] || {
    totalSales: 0,
    totalOrders: 0,
    avgOrderValue: 0,
    cashTotal: 0,
    cardTotal: 0,
    orangeMoneyTotal: 0,
    mtnMoneyTotal: 0,
  };

  return {
    totalSales: sales.totalSales,
    ordersCount: sales.totalOrders,
    avgOrderValue: Math.round(sales.avgOrderValue * 100) / 100,
    openTables,
    lowStockAlerts: lowStock,
    paymentBreakdown: {
      cash: sales.cashTotal,
      card: sales.cardTotal,
      orangeMoney: sales.orangeMoneyTotal,
      mtnMoney: sales.mtnMoneyTotal,
    },
  };
};

module.exports = { getDailySummary };
