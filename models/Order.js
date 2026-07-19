const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  menuItem: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MenuItem',
    required: true,
  },
  name: String,
  quantity: {
    type: Number,
    required: true,
    min: 1,
  },
  price: {
    type: Number,
    required: true,
  },
  modifiers: [
    {
      name: String,
      price: Number,
    },
  ],
  notes: String,
  status: {
    type: String,
    enum: ['pending', 'sent', 'preparing', 'ready', 'served', 'cancelled'],
    default: 'pending',
  },
});

const orderSchema = new mongoose.Schema(
  {
    orderNumber: {
      type: String,
      unique: true,
    },
    table: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Table',
    },
    waiter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    cashier: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    items: [orderItemSchema],
    subtotal: {
      type: Number,
      default: 0,
    },
    taxRate: {
      type: Number,
      default: 0,
    },
    taxAmount: {
      type: Number,
      default: 0,
    },
    discountType: {
      type: String,
      enum: ['percentage', 'fixed', null],
      default: null,
    },
    discountValue: {
      type: Number,
      default: 0,
    },
    discountAmount: {
      type: Number,
      default: 0,
    },
    total: {
      type: Number,
      default: 0,
    },
    paymentMethod: {
      type: String,
      enum: ['cash', 'card', 'orange_money', 'mtn_money', null],
      default: null,
    },
    paymentStatus: {
      type: String,
      enum: ['unpaid', 'partial', 'paid', 'refunded'],
      default: 'unpaid',
    },
    status: {
      type: String,
      enum: ['open', 'confirmed', 'preparing', 'ready', 'served', 'closed', 'cancelled'],
      default: 'open',
    },
    paidAmount: {
      type: Number,
      default: 0,
    },
    payments: [
      {
        method: {
          type: String,
          enum: ['cash', 'card', 'orange_money', 'mtn_money'],
        },
        amount: Number,
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    notes: String,
    branch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
    },
    cancelReason: String,
    cancelledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    cancelledAt: Date,
    refunds: [
      {
        amount: {
          type: Number,
          required: true,
        },
        reason: {
          type: String,
          required: true,
        },
        method: {
          type: String,
          enum: ['cash', 'card', 'orange_money', 'mtn_money'],
          required: true,
        },
        processedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          required: true,
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    closedAt: Date,
  },
  { timestamps: true }
);

orderSchema.pre('save', async function (next) {
  if (!this.orderNumber) {
    const date = new Date();
    const prefix = `ORD-${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
    const count = await mongoose.model('Order').countDocuments({
      createdAt: {
        $gte: new Date(date.getFullYear(), date.getMonth(), date.getDate()),
        $lt: new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1),
      },
    });
    this.orderNumber = `${prefix}-${String(count + 1).padStart(4, '0')}`;
  }
  next();
});

module.exports = mongoose.model('Order', orderSchema);
