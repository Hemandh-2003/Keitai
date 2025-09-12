const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  discountType: {
    type: String,
    enum: ['percentage', 'fixed'],
    required: true
  },
  discount: {
    type: Number,
    required: true,
    min: 1
  },
  minPurchase: {
    type: Number,
    default: 0  
  },
  maxDiscount: {
    type: Number,
    default: 0  
  },
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  }
});

couponSchema.pre('save', function (next) {
  this.code = this.code.toUpperCase().trim();
  next();
});

module.exports = mongoose.model('Coupon', couponSchema);
