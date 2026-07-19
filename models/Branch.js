const mongoose = require('mongoose');

const branchSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Branch name is required'],
      trim: true,
    },
    address: {
      type: String,
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    manager: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    taxRate: {
      type: Number,
      default: 0,
    },
    currency: {
      type: String,
      default: 'FCFA',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Branch', branchSchema);
