const mongoose = require('mongoose');

const offerSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true,
    trim: true
  },
  description: { 
    type: String,
    trim: true
  },
  discountType: { 
    type: String, 
    enum: ['percentage', 'fixed'], 
    required: true 
  },
  discountValue: { 
    type: Number, 
    required: true,
    min: 0
  },
  startDate: { 
    type: Date, 
    required: true,
    default: Date.now
  },
  endDate: { 
    type: Date, 
    required: true 
  },
  isActive: { 
    type: Boolean, 
    default: true 
  },
  offerType: { 
    type: String, 
    enum: ['product', 'category', 'referral'], 
    required: true 
  },
  products: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product'
  }],
  categories: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category'
  }],
  referralCode: {
    type: String,
    unique: true,
    sparse: true
  },
  referrerBonus: {
    type: Number,
    min: 0
  },
  refereeBonus: {
    type: Number,
    min: 0
  },
  minPurchaseAmount: {
    type: Number,
    min: 0
  }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Add validation to ensure end date is after start date
offerSchema.pre('save', function(next) {
  if (this.endDate <= this.startDate) {
    throw new Error('End date must be after start date');
  }
  next();
});

module.exports = mongoose.model('Offer', offerSchema);