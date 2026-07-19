const express = require('express');
const { protect, authorize } = require('../middleware/auth');
const {
  getReservations,
  getTodayReservations,
  getReservationById,
  createReservation,
  updateReservation,
  checkInReservation,
  cancelReservation,
  updateReservationStatus,
} = require('../controllers/reservationController');

const router = express.Router();

router.use(protect);

router.get('/today', getTodayReservations);
router.get('/', getReservations);
router.get('/:id', getReservationById);
router.post('/', createReservation);
router.put('/:id', updateReservation);
router.put('/:id/check-in', checkInReservation);
router.put('/:id/cancel', cancelReservation);
router.put('/:id/status', updateReservationStatus);

module.exports = router;
