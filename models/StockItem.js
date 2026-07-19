const mongoose = require('mongoose');

const stockItemSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Stock item name is required'],
      trim: true,
    },
    category: {
      type: String,
      enum: ['food_ingredient', 'beverage', 'packaging', 'cleaning', 'other'],
      required: true,
    },
    quantity: {
      type: Number,
      default: 0,
      min: 0,
    },
    unit: {
      type: String,
      enum: ['kg', 'g', 'l', 'ml', 'pcs', 'bottles', 'cases'],
      required: true,
    },
    reorderLevel: {
      type: Number,
      default: 0,
    },
    costPerUnit: {
      type: Number,
      default: 0,
    },
    supplier: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Supplier',
      default: null,
    },
    branch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
    },
  },
  { timestamps: true }
);

stockItemSchema.virtual('isLowStock').get(function () {
  return this.quantity <= this.reorderLevel;
});

stockItemSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('StockItem', stockItemSchema);
