const reservationService = require('../services/reservationService');

const getReservations = async (req, res) => {
  try {
    const filters = {
      branch: req.query.branch || req.user.branch,
      status: req.query.status,
      dateFrom: req.query.dateFrom,
      dateTo: req.query.dateTo,
      date: req.query.date,
      search: req.query.search,
      page: req.query.page,
      limit: req.query.limit,
    };
    const result = await reservationService.getReservations(filters);
    res.status(200).json({ success: true, data: result.reservations, pagination: result.pagination });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getTodayReservations = async (req, res) => {
  try {
    const branchId = req.query.branch || req.user.branch;
    const reservations = await reservationService.getTodayReservations(branchId);
    res.status(200).json({ success: true, data: reservations });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getReservationById = async (req, res) => {
  try {
    const reservation = await reservationService.getReservationById(req.params.id);
    if (!reservation) {
      return res.status(404).json({ success: false, message: 'Reservation not found' });
    }
    res.status(200).json({ success: true, data: reservation });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const createReservation = async (req, res) => {
  try {
    const data = {
      ...req.body,
      branch: req.body.branch || req.user.branch,
      createdBy: req.user._id,
    };
    const reservation = await reservationService.createReservation(data);
    res.status(201).json({ success: true, data: reservation });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const updateReservation = async (req, res) => {
  try {
    const reservation = await reservationService.updateReservation(req.params.id, req.body);
    res.status(200).json({ success: true, data: reservation });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const checkInReservation = async (req, res) => {
  try {
    const reservation = await reservationService.checkInReservation(req.params.id);
    res.status(200).json({ success: true, data: reservation });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const cancelReservation = async (req, res) => {
  try {
    const reservation = await reservationService.cancelReservation(req.params.id, req.body.reason);
    res.status(200).json({ success: true, data: reservation });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const updateReservationStatus = async (req, res) => {
  try {
    const reservation = await reservationService.updateReservationStatus(req.params.id, req.body.status);
    res.status(200).json({ success: true, data: reservation });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
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
