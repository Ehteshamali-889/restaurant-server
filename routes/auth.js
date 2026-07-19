const express = require('express');
const { login, getMe, getUsers } = require('../controllers/authController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.post('/login', login);
router.get('/me', protect, getMe);
router.get('/users', protect, getUsers);

module.exports = router;
