const mongoose = require('mongoose');

const payrollSchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    period: {
      month: {
        type: Number,
        required: true,
        min: 1,
        max: 12,
      },
      year: {
        type: Number,
        required: true,
      },
    },
    baseSalary: {
      type: Number,
      required: [true, 'Base salary is required'],
      min: 0,
    },
    hoursWorked: {
      type: Number,
      default: 0,
      min: 0,
    },
    overtimeHours: {
      type: Number,
      default: 0,
      min: 0,
    },
    overtimeRate: {
      type: Number,
      default: 1.5,
    },
    bonuses: {
      type: Number,
      default: 0,
      min: 0,
    },
    deductions: {
      type: Number,
      default: 0,
      min: 0,
    },
    taxAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    netPay: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ['pending', 'processed', 'paid'],
      default: 'pending',
    },
    paidAt: Date,
    notes: String,
    branch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
      required: true,
    },
    processedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true }
);

payrollSchema.index({ branch: 1, 'period.month': 1, 'period.year': 1 });
payrollSchema.index({ employee: 1, 'period.month': 1, 'period.year': 1 });

payrollSchema.pre('save', function (next) {
  const overtimePay = this.overtimeHours * (this.baseSalary / 160) * this.overtimeRate;
  this.netPay = this.baseSalary + overtimePay + this.bonuses - this.deductions - this.taxAmount;
  next();
});

module.exports = mongoose.model('Payroll', payrollSchema);
