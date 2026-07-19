const mongoose = require('mongoose');

const menuItemSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Item name is required'],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: 0,
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: true,
    },
    image: {
      type: String,
      default: null,
    },
    isAvailable: {
      type: Boolean,
      default: true,
    },
    modifiers: [
      {
        name: String,
        price: Number,
      },
    ],
    stockItem: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'StockItem',
      default: null,
    },
    stockQuantityPerUnit: {
      type: Number,
      default: 0,
    },
    branch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('MenuItem', menuItemSchema);
