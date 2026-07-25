const Reservation = require('../models/Reservation');
const Table = require('../models/Table');

const getReservations = async (filters = {}) => {
  const query = {};
  if (filters.branch) query.branch = filters.branch;
  if (filters.status) query.status = filters.status;

  if (filters.dateFrom || filters.dateTo) {
    query.date = {};
    if (filters.dateFrom) {
      const start = new Date(filters.dateFrom);
      start.setHours(0, 0, 0, 0);
      query.date.$gte = start;
    }
    if (filters.dateTo) {
      const end = new Date(filters.dateTo);
      end.setHours(23, 59, 59, 999);
      query.date.$lte = end;
    }
  } else if (filters.date) {
    const start = new Date(filters.date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    query.date = { $gte: start, $lt: end };
  }

  if (filters.search) {
    query.$or = [
      { customerName: { $regex: filters.search, $options: 'i' } },
      { customerPhone: { $regex: filters.search, $options: 'i' } },
    ];
  }

  const page = Math.max(1, parseInt(filters.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(filters.limit) || 20));
  const skip = (page - 1) * limit;

  const [reservations, total] = await Promise.all([
    Reservation.find(query)
      .populate('table', 'number section capacity')
      .populate('branch', 'name')
      .populate('createdBy', 'fullName')
      .sort({ date: 1, time: 1 })
      .skip(skip)
      .limit(limit),
    Reservation.countDocuments(query),
  ]);

  return {
    reservations,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
};

const getTodayReservations = async (branchId, filters = {}) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const query = {
    date: { $gte: today, $lt: tomorrow },
  };
  if (branchId) query.branch = branchId;

  const page = Math.max(1, parseInt(filters.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(filters.limit) || 50));
  const skip = (page - 1) * limit;

  const [reservations, total] = await Promise.all([
    Reservation.find(query)
      .populate('table', 'number section capacity')
      .populate('branch', 'name')
      .populate('createdBy', 'fullName')
      .sort({ time: 1 })
      .skip(skip)
      .limit(limit),
    Reservation.countDocuments(query),
  ]);

  return {
    reservations,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
};

const getReservationById = async (id) => {
  return Reservation.findById(id)
    .populate('table', 'number section capacity status')
    .populate('branch', 'name')
    .populate('createdBy', 'fullName username');
};

const checkTableAvailability = async (tableId, date, time, excludeReservationId) => {
  const reservationDate = new Date(date);
  reservationDate.setHours(0, 0, 0, 0);
  const nextDay = new Date(reservationDate);
  nextDay.setDate(nextDay.getDate() + 1);

  const query = {
    table: tableId,
    date: { $gte: reservationDate, $lt: nextDay },
    time: time,
    status: { $nin: ['cancelled', 'no-show'] },
  };

  if (excludeReservationId) {
    query._id = { $ne: excludeReservationId };
  }

  const existing = await Reservation.findOne(query);
  return !existing;
};

const createReservation = async (data) => {
  if (data.table) {
    const available = await checkTableAvailability(data.table, data.date, data.time);
    if (!available) {
      throw new Error('Table is already reserved for this date and time');
    }

    const table = await Table.findById(data.table);
    if (!table) throw new Error('Table not found');
    if (data.partySize > table.capacity) {
      throw new Error(`Party size (${data.partySize}) exceeds table capacity (${table.capacity})`);
    }
  }

  const reservation = await Reservation.create({
    ...data,
    status: 'confirmed',
  });

  if (data.table) {
    await Table.findByIdAndUpdate(data.table, { status: 'reserved' });
  }

  return Reservation.findById(reservation._id)
    .populate('table', 'number section capacity')
    .populate('branch', 'name')
    .populate('createdBy', 'fullName');
};

const updateReservation = async (id, data) => {
  const reservation = await Reservation.findById(id);
  if (!reservation) throw new Error('Reservation not found');

  if (['completed', 'cancelled', 'no-show'].includes(reservation.status)) {
    throw new Error(`Cannot update a reservation with status "${reservation.status}"`);
  }

  if (data.table && data.table !== (reservation.table ? reservation.table.toString() : null)) {
    const date = data.date || reservation.date;
    const time = data.time || reservation.time;
    const available = await checkTableAvailability(data.table, date, time, id);
    if (!available) {
      throw new Error('Table is already reserved for this date and time');
    }

    const table = await Table.findById(data.table);
    if (!table) throw new Error('Table not found');
    const partySize = data.partySize || reservation.partySize;
    if (partySize > table.capacity) {
      throw new Error(`Party size (${partySize}) exceeds table capacity (${table.capacity})`);
    }

    if (reservation.table) {
      const hasActiveReservations = await Reservation.findOne({
        table: reservation.table,
        _id: { $ne: id },
        date: reservation.date,
        time: reservation.time,
        status: { $nin: ['cancelled', 'no-show'] },
      });
      if (!hasActiveReservations) {
        await Table.findByIdAndUpdate(reservation.table, { status: 'available' });
      }
    }
    await Table.findByIdAndUpdate(data.table, { status: 'reserved' });
  }

  const allowed = ['customerName', 'customerPhone', 'date', 'time', 'partySize', 'table', 'isVIP', 'notes'];
  for (const key of allowed) {
    if (data[key] !== undefined) reservation[key] = data[key];
  }

  await reservation.save();

  return Reservation.findById(reservation._id)
    .populate('table', 'number section capacity')
    .populate('branch', 'name')
    .populate('createdBy', 'fullName');
};

const checkInReservation = async (id) => {
  const reservation = await Reservation.findById(id);
  if (!reservation) throw new Error('Reservation not found');

  if (!['pending', 'confirmed'].includes(reservation.status)) {
    throw new Error(`Cannot check in a reservation with status "${reservation.status}"`);
  }

  reservation.status = 'arrived';
  await reservation.save();

  if (reservation.table) {
    await Table.findByIdAndUpdate(reservation.table, { status: 'occupied' });
  }

  return Reservation.findById(reservation._id)
    .populate('table', 'number section capacity status')
    .populate('branch', 'name')
    .populate('createdBy', 'fullName');
};

const cancelReservation = async (id, reason) => {
  const reservation = await Reservation.findById(id);
  if (!reservation) throw new Error('Reservation not found');

  if (['completed', 'cancelled', 'no-show'].includes(reservation.status)) {
    throw new Error(`Cannot cancel a reservation with status "${reservation.status}"`);
  }

  reservation.status = 'cancelled';
  reservation.cancelReason = reason || '';
  await reservation.save();

  if (reservation.table) {
    const hasActiveReservations = await Reservation.findOne({
      table: reservation.table,
      _id: { $ne: id },
      date: reservation.date,
      time: reservation.time,
      status: { $nin: ['cancelled', 'no-show'] },
    });
    if (!hasActiveReservations) {
      await Table.findByIdAndUpdate(reservation.table, { status: 'available' });
    }
  }

  return Reservation.findById(reservation._id)
    .populate('table', 'number section capacity')
    .populate('branch', 'name')
    .populate('createdBy', 'fullName');
};

const updateReservationStatus = async (id, status) => {
  const reservation = await Reservation.findById(id);
  if (!reservation) throw new Error('Reservation not found');

  const validTransitions = {
    pending: ['confirmed', 'cancelled', 'no-show'],
    confirmed: ['arrived', 'cancelled', 'no-show'],
    arrived: ['seated', 'cancelled'],
    seated: ['completed'],
    completed: [],
    cancelled: [],
    'no-show': [],
  };

  if (!validTransitions[reservation.status] || !validTransitions[reservation.status].includes(status)) {
    throw new Error(`Cannot transition from "${reservation.status}" to "${status}"`);
  }

  reservation.status = status;
  await reservation.save();

  if (status === 'cancelled' && reservation.table) {
    const hasActiveReservations = await Reservation.findOne({
      table: reservation.table,
      _id: { $ne: id },
      date: reservation.date,
      time: reservation.time,
      status: { $nin: ['cancelled', 'no-show'] },
    });
    if (!hasActiveReservations) {
      await Table.findByIdAndUpdate(reservation.table, { status: 'available' });
    }
  }

  if (status === 'arrived' && reservation.table) {
    await Table.findByIdAndUpdate(reservation.table, { status: 'occupied' });
  }

  return Reservation.findById(reservation._id)
    .populate('table', 'number section capacity status')
    .populate('branch', 'name')
    .populate('createdBy', 'fullName');
};

module.exports = {
  getReservations,
  getTodayReservations,
  getReservationById,
  createReservation,
  updateReservation,
  checkInReservation,
  cancelReservation,
  updateReservationStatus,
};
