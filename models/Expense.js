const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema(
  {
    description: {
      type: String,
      required: [true, 'Expense description is required'],
      trim: true,
    },
    category: {
      type: String,
      enum: ['rent', 'utilities', 'ingredients', 'salaries', 'maintenance', 'marketing', 'insurance', 'supplies', 'taxes', 'other'],
      required: true,
    },
    amount: {
      type: Number,
      required: [true, 'Amount is required'],
      min: 0,
    },
    date: {
      type: Date,
      default: Date.now,
    },
    paymentMethod: {
      type: String,
      enum: ['cash', 'card', 'bank_transfer', 'check'],
      default: 'cash',
    },
    isRecurring: {
      type: Boolean,
      default: false,
    },
    recurringPeriod: {
      type: String,
      enum: ['daily', 'weekly', 'monthly', 'yearly', null],
      default: null,
    },
    reference: {
      type: String,
      trim: true,
    },
    notes: {
      type: String,
      trim: true,
    },
    branch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
      required: true,
    },
    recordedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true }
);

expenseSchema.index({ branch: 1, date: -1 });
expenseSchema.index({ branch: 1, category: 1 });
expenseSchema.index({ date: -1 });

module.exports = mongoose.model('Expense', expenseSchema);
