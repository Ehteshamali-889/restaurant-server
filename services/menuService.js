const MenuItem = require('../models/MenuItem');
const Category = require('../models/Category');
const Modifier = require('../models/Modifier');

const getCategories = async (includeInactive = false) => {
  const filter = includeInactive ? {} : { isActive: true };
  return Category.find(filter).sort({ displayOrder: 1 });
};

const getCategoryById = async (id) => {
  return Category.findById(id);
};

const createCategory = async (data) => {
  const category = await Category.create(data);
  return category;
};

const updateCategory = async (id, data) => {
  return Category.findByIdAndUpdate(id, data, { new: true, runValidators: true });
};

const deleteCategory = async (id) => {
  const itemCount = await MenuItem.countDocuments({ category: id });
  if (itemCount > 0) {
    throw new Error(`Cannot delete category: ${itemCount} menu item(s) still reference it`);
  }
  return Category.findByIdAndDelete(id);
};

const getMenuItems = async (filters = {}) => {
  const query = {};
  if (filters.category) query.category = filters.category;
  if (filters.branch) query.branch = filters.branch;
  if (filters.isAvailable !== undefined) query.isAvailable = filters.isAvailable;
  if (filters.search) {
    query.name = { $regex: filters.search, $options: 'i' };
  }

  const page = Math.max(1, parseInt(filters.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(filters.limit) || 20));
  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    MenuItem.find(query)
      .populate('category', 'name')
      .sort({ name: 1 })
      .skip(skip)
      .limit(limit),
    MenuItem.countDocuments(query),
  ]);

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
};

const getMenuItemById = async (id) => {
  return MenuItem.findById(id).populate('category', 'name');
};

const createMenuItem = async (data) => {
  const item = await MenuItem.create(data);
  return item.populate('category', 'name');
};

const updateMenuItem = async (id, data) => {
  return MenuItem.findByIdAndUpdate(id, data, { new: true, runValidators: true }).populate('category', 'name');
};

const deleteMenuItem = async (id) => {
  return MenuItem.findByIdAndDelete(id);
};

const toggleAvailability = async (id) => {
  const item = await MenuItem.findById(id);
  if (!item) throw new Error('Menu item not found');
  item.isAvailable = !item.isAvailable;
  await item.save();
  return item.populate('category', 'name');
};

const getModifiers = async (filters = {}) => {
  const query = {};
  if (filters.branch) query.branch = filters.branch;
  if (filters.group) query.group = filters.group;
  return Modifier.find(query).sort({ group: 1, name: 1 });
};

const getModifierById = async (id) => {
  return Modifier.findById(id);
};

const createModifier = async (data) => {
  return Modifier.create(data);
};

const updateModifier = async (id, data) => {
  return Modifier.findByIdAndUpdate(id, data, { new: true, runValidators: true });
};

const deleteModifier = async (id) => {
  return Modifier.findByIdAndDelete(id);
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
