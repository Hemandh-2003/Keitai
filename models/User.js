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
    enum: ['Credit', 'Debit', 'Refund'],
    required: true,
  },
  amount: {
    type: Number,
    required: true,
  },
  reason: {
    type: String,
    required: true,
    default: 'N/A',
  },
  orderId: {
    type: String,
  },
  date: {
    type: Date,
    default: Date.now,
  },
});

// User Schema
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String },
  isBlocked: { type: Boolean, default: false },
  googleId: { type: String },
  addresses: { type: [addressSchema], default: [] },

  // Wallet Section
  wallet: {
    balance: { type: Number, default: 0 },
    transactions: [walletTransactionSchema],
  },

  // Track used coupons
  usedCoupons: { type: [String], default: [] },

  // ✅ User referral system
  referralCode: { type: String, unique: true }, // User’s own referral code
  referredBy: { type: String, default: null },  // Who referred them (store referrer’s code)
  referralRewards: { type: Number, default: 0 }, // Total earned from referrals
  userCode: { type: String, unique: true, sparse: true  },
});

// Auto-generate referralCode if not exists
userSchema.pre('save', async function (next) {
  if (!this.referralCode) {
    this.referralCode = await generateUniqueReferralCode();
  }
  next();
});

// Function to generate unique referral code
async function generateUniqueReferralCode() {
  let code;
  let user;
  do {
    code = Math.random().toString(36).substring(2, 8).toUpperCase(); // e.g., "X7Y9AB"
    user = await mongoose.model('User').findOne({ referralCode: code });
  } while (user);
  return code;
}

module.exports = mongoose.model('User', userSchema);
