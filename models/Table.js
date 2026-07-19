const mongoose = require('mongoose');

const tableSchema = new mongoose.Schema(
  {
    number: {
      type: Number,
      required: true,
      unique: true,
    },
    capacity: {
      type: Number,
      required: true,
      min: 1,
    },
    section: {
      type: String,
      enum: ['indoor', 'outdoor', 'vip', 'terrace'],
      default: 'indoor',
    },
    status: {
      type: String,
      enum: ['available', 'occupied', 'reserved', 'maintenance'],
      default: 'available',
    },
    currentOrder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
    },
    assignedWaiter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    branch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Table', tableSchema);
