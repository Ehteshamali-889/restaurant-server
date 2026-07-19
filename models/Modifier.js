const mongoose = require('mongoose');

const modifierSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Modifier name is required'],
      trim: true,
    },
    group: {
      type: String,
      required: [true, 'Modifier group is required'],
      trim: true,
    },
    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: 0,
      default: 0,
    },
    isAvailable: {
      type: Boolean,
      default: true,
    },
    branch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
    },
  },
  { timestamps: true }
);

modifierSchema.index({ name: 1, group: 1, branch: 1 }, { unique: true });

module.exports = mongoose.model('Modifier', modifierSchema);
