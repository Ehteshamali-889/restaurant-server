const express = require('express');
const { protect } = require('../middleware/auth');
const { getMenuItems, getMenuItemById } = require('../controllers/menuController');

const router = express.Router();

router.use(protect);

router.get('/', getMenuItems);
router.get('/:id', getMenuItemById);

module.exports = router;
