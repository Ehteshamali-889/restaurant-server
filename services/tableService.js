const Table = require('../models/Table');

const getTables = async (filters = {}) => {
  const query = {};
  if (filters.branch) query.branch = filters.branch;
  if (filters.section) query.section = filters.section;
  if (filters.status) query.status = filters.status;

  const page = Math.max(1, parseInt(filters.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(filters.limit) || 50));
  const skip = (page - 1) * limit;

  const [tables, total] = await Promise.all([
    Table.find(query)
      .populate('currentOrder', 'orderNumber total status items')
      .populate('assignedWaiter', 'fullName')
      .sort({ number: 1 })
      .skip(skip)
      .limit(limit),
    Table.countDocuments(query),
  ]);

  return {
    tables,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
};

const getTableStats = async (branchId) => {
  const matchFilter = {};
  if (branchId) matchFilter.branch = branchId;

  const stats = await Table.aggregate([
    { $match: matchFilter },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
      },
    },
  ]);

  const result = { available: 0, occupied: 0, reserved: 0, maintenance: 0, total: 0 };
  for (const s of stats) {
    result[s._id] = s.count;
    result.total += s.count;
  }
  return result;
};

const getTableById = async (id) => {
  return Table.findById(id)
    .populate('currentOrder')
    .populate('assignedWaiter', 'fullName username');
};

const createTable = async (data) => {
  return Table.create(data);
};

const updateTable = async (id, data) => {
  return Table.findByIdAndUpdate(id, data, { new: true, runValidators: true });
};

const assignWaiter = async (tableId, waiterId) => {
  return Table.findByIdAndUpdate(
    tableId,
    { assignedWaiter: waiterId },
    { new: true }
  ).populate('assignedWaiter', 'fullName username');
};

const updateStatus = async (tableId, status) => {
  return Table.findByIdAndUpdate(
    tableId,
    { status },
    { new: true }
  );
};

const deleteTable = async (id) => {
  const table = await Table.findById(id);
  if (!table) {
    throw new Error('Table not found');
  }
  if (table.status === 'occupied') {
    throw new Error('Cannot delete an occupied table. Close the order first.');
  }
  return Table.findByIdAndDelete(id);
};

module.exports = {
  getTables,
  getTableStats,
  getTableById,
  createTable,
  updateTable,
  assignWaiter,
  updateStatus,
  deleteTable,
};
