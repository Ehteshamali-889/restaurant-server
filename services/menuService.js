const MenuItem = require('../models/MenuItem');
const Category = require('../models/Category');

const getCategories = async () => {
  return Category.find({ isActive: true }).sort({ displayOrder: 1 });
};

const getMenuItems = async (filters = {}) => {
  const query = {};
  if (filters.category) query.category = filters.category;
  if (filters.branch) query.branch = filters.branch;
  if (filters.isAvailable !== undefined) query.isAvailable = filters.isAvailable;

  return MenuItem.find(query)
    .populate('category', 'name')
    .sort({ name: 1 });
};

const getMenuItemById = async (id) => {
  return MenuItem.findById(id).populate('category', 'name');
};

module.exports = { getCategories, getMenuItems, getMenuItemById };
