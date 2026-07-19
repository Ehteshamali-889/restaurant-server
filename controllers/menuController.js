const menuService = require('../services/menuService');

const getCategories = async (req, res) => {
  try {
    const categories = await menuService.getCategories();
    res.status(200).json({ success: true, data: categories });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getMenuItems = async (req, res) => {
  try {
    const filters = {
      category: req.query.category,
      branch: req.query.branch || req.user.branch,
      isAvailable: req.query.isAvailable !== undefined ? req.query.isAvailable === 'true' : undefined,
    };
    const items = await menuService.getMenuItems(filters);
    res.status(200).json({ success: true, data: items });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getMenuItemById = async (req, res) => {
  try {
    const item = await menuService.getMenuItemById(req.params.id);
    if (!item) {
      return res.status(404).json({ success: false, message: 'Menu item not found' });
    }
    res.status(200).json({ success: true, data: item });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { getCategories, getMenuItems, getMenuItemById };
