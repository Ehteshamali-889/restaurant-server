const menuService = require('../services/menuService');

const getCategories = async (req, res) => {
  try {
    const includeInactive = req.query.all === 'true';
    const categories = await menuService.getCategories(includeInactive);
    res.status(200).json({ success: true, data: categories });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getCategoryById = async (req, res) => {
  try {
    const category = await menuService.getCategoryById(req.params.id);
    if (!category) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }
    res.status(200).json({ success: true, data: category });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const createCategory = async (req, res) => {
  try {
    const category = await menuService.createCategory(req.body);
    res.status(201).json({ success: true, data: category });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: 'Category name already exists' });
    }
    res.status(400).json({ success: false, message: error.message });
  }
};

const updateCategory = async (req, res) => {
  try {
    const category = await menuService.updateCategory(req.params.id, req.body);
    if (!category) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }
    res.status(200).json({ success: true, data: category });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: 'Category name already exists' });
    }
    res.status(400).json({ success: false, message: error.message });
  }
};

const deleteCategory = async (req, res) => {
  try {
    const category = await menuService.deleteCategory(req.params.id);
    if (!category) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }
    res.status(200).json({ success: true, data: {} });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
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

const createMenuItem = async (req, res) => {
  try {
    const item = await menuService.createMenuItem(req.body);
    res.status(201).json({ success: true, data: item });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const updateMenuItem = async (req, res) => {
  try {
    const item = await menuService.updateMenuItem(req.params.id, req.body);
    if (!item) {
      return res.status(404).json({ success: false, message: 'Menu item not found' });
    }
    res.status(200).json({ success: true, data: item });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const deleteMenuItem = async (req, res) => {
  try {
    const item = await menuService.deleteMenuItem(req.params.id);
    if (!item) {
      return res.status(404).json({ success: false, message: 'Menu item not found' });
    }
    res.status(200).json({ success: true, data: {} });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const toggleAvailability = async (req, res) => {
  try {
    const item = await menuService.toggleAvailability(req.params.id);
    res.status(200).json({ success: true, data: item });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const getModifiers = async (req, res) => {
  try {
    const filters = {
      branch: req.query.branch || req.user.branch,
      group: req.query.group,
    };
    const modifiers = await menuService.getModifiers(filters);
    res.status(200).json({ success: true, data: modifiers });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getModifierById = async (req, res) => {
  try {
    const modifier = await menuService.getModifierById(req.params.id);
    if (!modifier) {
      return res.status(404).json({ success: false, message: 'Modifier not found' });
    }
    res.status(200).json({ success: true, data: modifier });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const createModifier = async (req, res) => {
  try {
    const modifier = await menuService.createModifier(req.body);
    res.status(201).json({ success: true, data: modifier });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: 'Modifier with this name already exists in this group' });
    }
    res.status(400).json({ success: false, message: error.message });
  }
};

const updateModifier = async (req, res) => {
  try {
    const modifier = await menuService.updateModifier(req.params.id, req.body);
    if (!modifier) {
      return res.status(404).json({ success: false, message: 'Modifier not found' });
    }
    res.status(200).json({ success: true, data: modifier });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: 'Modifier with this name already exists in this group' });
    }
    res.status(400).json({ success: false, message: error.message });
  }
};

const deleteModifier = async (req, res) => {
  try {
    const modifier = await menuService.deleteModifier(req.params.id);
    if (!modifier) {
      return res.status(404).json({ success: false, message: 'Modifier not found' });
    }
    res.status(200).json({ success: true, data: {} });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
  getMenuItems,
  getMenuItemById,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
  toggleAvailability,
  getModifiers,
  getModifierById,
  createModifier,
  updateModifier,
  deleteModifier,
};
