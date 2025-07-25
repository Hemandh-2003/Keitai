const mongoose = require('mongoose');

// Address Schema
const addressSchema = new mongoose.Schema({
  name: { type: String, required: true },
  street: { type: String, required: true },
  city: { type: String, required: true },
  state: { type: String, required: true },
  zip: { type: String, required: true },
  country: { type: String, required: true },
  phone: { type: String, required: true },
  default: { type: Boolean, default: false },
});

const walletTransactionSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['Credit', 'Debit'],
    required: true,
  },
  amount: {
    type: Number,
    required: true,
  },
  reason: {
    type: String,
    required: true,
  },
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
  },
  date: {
    type: Date,
    default: Date.now,
  }
});

// User Schema
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String },
  isBlocked: { type: Boolean, default: false },
  googleId: { type: String },
  addresses: { type: [addressSchema], default: [] },

  // ✅ Wallet Section
  wallet: {
    balance: { type: Number, default: 0 },
    transactions: [walletTransactionSchema],
  },
 // ✅ Track used coupons
  usedCoupons: {
    type: [String],
    default: []
  }
});

module.exports = mongoose.model('User', userSchema);
