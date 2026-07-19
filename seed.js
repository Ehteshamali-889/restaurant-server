const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const User = require('./models/User');
const Category = require('./models/Category');
const Table = require('./models/Table');
const MenuItem = require('./models/MenuItem');
const StockItem = require('./models/StockItem');
const Branch = require('./models/Branch');
const Order = require('./models/Order');

dotenv.config();

const seed = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB connected for seeding...');

    await User.deleteMany();
    await Category.deleteMany();
    await Table.deleteMany();
    await MenuItem.deleteMany();
    await StockItem.deleteMany();
    await Branch.deleteMany();
    await Order.deleteMany();

    const branch = await Branch.create({
      name: 'Main Branch',
      address: '123 Restaurant Street',
      phone: '+237 600 000 000',
      taxRate: 0,
      currency: 'FCFA',
    });

    await User.create([
      { username: 'admin', password: 'admin123', fullName: 'System Admin', role: 'admin', branch: branch._id },
      { username: 'manager', password: 'manager123', fullName: 'Floor Manager', role: 'manager', branch: branch._id },
      { username: 'cashier', password: 'cashier123', fullName: 'Main Cashier', role: 'cashier', branch: branch._id },
      { username: 'waiter1', password: 'waiter123', fullName: 'John Waiter', role: 'waiter', branch: branch._id },
    ]);

    const categories = await Category.insertMany([
      { name: 'Food', displayOrder: 1 },
      { name: 'Drinks', displayOrder: 2 },
      { name: 'Desserts', displayOrder: 3 },
    ]);

    const tables = [];
    for (let i = 1; i <= 12; i++) {
      tables.push({
        number: i,
        capacity: i <= 4 ? 2 : i <= 8 ? 4 : 6,
        section: i <= 4 ? 'indoor' : i <= 8 ? 'indoor' : 'outdoor',
        branch: branch._id,
      });
    }
    await Table.insertMany(tables);

    const stockItems = await StockItem.insertMany([
      { name: 'Rice', category: 'food_ingredient', quantity: 50, unit: 'kg', reorderLevel: 10, costPerUnit: 500, branch: branch._id },
      { name: 'Chicken', category: 'food_ingredient', quantity: 20, unit: 'kg', reorderLevel: 5, costPerUnit: 2000, branch: branch._id },
      { name: 'Cooking Oil', category: 'food_ingredient', quantity: 15, unit: 'l', reorderLevel: 3, costPerUnit: 1500, branch: branch._id },
      { name: 'Coca Cola', category: 'beverage', quantity: 2, unit: 'bottles', reorderLevel: 5, costPerUnit: 500, branch: branch._id },
      { name: 'Water', category: 'beverage', quantity: 30, unit: 'bottles', reorderLevel: 10, costPerUnit: 200, branch: branch._id },
    ]);

    await MenuItem.insertMany([
      { name: 'Jollof Rice', price: 3000, category: categories[0]._id, stockItem: stockItems[0]._id, stockQuantityPerUnit: 0.3, branch: branch._id },
      { name: 'Grilled Chicken', price: 5000, category: categories[0]._id, stockItem: stockItems[1]._id, stockQuantityPerUnit: 0.25, branch: branch._id },
      { name: 'Fried Plantain', price: 1500, category: categories[0]._id, branch: branch._id },
      { name: 'Coca Cola', price: 1000, category: categories[1]._id, stockItem: stockItems[3]._id, stockQuantityPerUnit: 1, branch: branch._id },
      { name: 'Water', price: 500, category: categories[1]._id, stockItem: stockItems[4]._id, stockQuantityPerUnit: 1, branch: branch._id },
      { name: 'Ice Cream', price: 2000, category: categories[2]._id, branch: branch._id },
    ]);

    console.log('Seed completed successfully!');
    console.log('Login credentials:');
    console.log('  admin / admin123');
    console.log('  manager / manager123');
    console.log('  cashier / cashier123');
    console.log('  waiter1 / waiter123');
    process.exit(0);
  } catch (error) {
    console.error('Seed error:', error);
    process.exit(1);
  }
};

seed();
