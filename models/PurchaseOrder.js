const mongoose = require('mongoose');

const purchaseOrderSchema = new mongoose.Schema(
  {
    orderNumber: {
      type: String,
      unique: true,
    },
    supplier: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Supplier',
      required: true,
    },
    items: [
      {
        stockItem: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'StockItem',
          required: true,
        },
        quantity: {
          type: Number,
          required: true,
          min: 0.01,
        },
        unitCost: {
          type: Number,
          required: true,
          min: 0,
        },
      },
    ],
    totalAmount: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ['draft', 'sent', 'received', 'cancelled'],
      default: 'draft',
    },
    expectedDate: {
      type: Date,
      default: null,
    },
    receivedDate: {
      type: Date,
      default: null,
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
    createdBy: {
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

purchaseOrderSchema.pre('save', async function (next) {
  if (!this.orderNumber) {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const PO = mongoose.model('PurchaseOrder');
    const count = await PO.countDocuments({
      createdAt: {
        $gte: new Date(date.getFullYear(), date.getMonth(), date.getDate()),
        $lt: new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1),
      },
    });
    this.orderNumber = `PO-${dateStr}-${String(count + 1).padStart(4, '0')}`;
  }

  if (this.items && this.items.length > 0) {
    this.totalAmount = this.items.reduce((sum, item) => sum + item.quantity * item.unitCost, 0);
  }

  next();
});

purchaseOrderSchema.index({ branch: 1, status: 1 });
purchaseOrderSchema.index({ supplier: 1 });

module.exports = mongoose.model('PurchaseOrder', purchaseOrderSchema);
