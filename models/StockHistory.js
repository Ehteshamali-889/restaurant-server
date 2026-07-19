const mongoose = require('mongoose');

const stockHistorySchema = new mongoose.Schema(
  {
    stockItem: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'StockItem',
      required: true,
    },
    type: {
      type: String,
      enum: ['purchase', 'adjustment', 'usage', 'waste', 'damage', 'count_correction', 'transfer'],
      required: true,
    },
    quantityBefore: {
      type: Number,
      required: true,
    },
    quantityChange: {
      type: Number,
      required: true,
    },
    quantityAfter: {
      type: Number,
      required: true,
    },
    reason: {
      type: String,
      trim: true,
      default: '',
    },
    reference: {
      type: String,
      trim: true,
      default: '',
    },
    purchaseOrder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PurchaseOrder',
      default: null,
    },
    performedBy: {
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

stockHistorySchema.index({ stockItem: 1, createdAt: -1 });
stockHistorySchema.index({ branch: 1, createdAt: -1 });
stockHistorySchema.index({ type: 1 });

module.exports = mongoose.model('StockHistory', stockHistorySchema);
