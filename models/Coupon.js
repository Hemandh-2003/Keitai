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
  startDate: {
    type: Date,
    required: true
  },
  coupon: {
  type: mongoose.Schema.Types.ObjectId,
  ref: 'Coupon',
  default: null
},
couponDiscount: {
  type: Number,
  default: 0
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

// ✅ Auto-uppercase and trim coupon code before saving
couponSchema.pre('save', function (next) {
  this.code = this.code.toUpperCase().trim();
  next();
});

module.exports = mongoose.model('Coupon', couponSchema);
