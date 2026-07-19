const express = require('express');
const { protect } = require('../middleware/auth');
const { getCategories } = require('../controllers/menuController');

const router = express.Router();

router.use(protect);

router.get('/', getCategories);

module.exports = router;
