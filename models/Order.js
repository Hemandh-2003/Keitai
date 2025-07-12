const mongoose = require('mongoose');
const shortid = require('shortid');

const orderSchema = new mongoose.Schema({
  orderId: {
    type: String,
    default: shortid.generate,
    unique: true,
    index: true,
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  products: [
    {
      product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true,
      },
      quantity: {
        type: Number,
        required: true,
        min: 1,
      },
    },
  ],
  cancellationReason: {
    type: String,
    default: '',
  },
  returnRequested: {
    type: Boolean,
    default: false,
  },
  returnReason: {
    type: String,
    default: '',
  },
  returnedItems: [
    {
      product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
      },
      quantity: {
        type: Number,
        min: 1,
      },
      reason: String,
    }
  ],
  returnStatus: {
    type: String,
    enum: ['None', 'Requested', 'Approved', 'Rejected'],
    default: 'None',
  },
  deliveryCharge: {
    type: Number,
    default: 80,
  },
  discountAmount: {
    type: Number,
    default: 0
  },
  couponDiscount: {
    type: Number,
    default: 0
  },
  totalAmount: {
    type: Number,
    required: true,
  },
  selectedAddress: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  paymentMethod: {
    type: String,
    enum: ['COD', 'Card', 'Online'],
    required: true,
  },
  estimatedDelivery: {
    type: Date,
    required: true,
  },
  status: {
    type: String,
    enum: [
      'Pending',
      'Placed',
      'Shipped',
      'Delivered',
      'Cancelled',
      'User Cancelled',
      'Return Requested' // ✅ Added here
    ],
    default: 'Pending',
  },
  statusHistory: [
    {
      status: {
        type: String,
        enum: [
          'Pending',
          'Placed',
          'Shipped',
          'Delivered',
          'Cancelled',
          'User Cancelled',
          'Return Requested' // ✅ Added here
        ],
      },
      updatedAt: {
        type: Date,
        default: Date.now,
      },
    }
  ],
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Auto-update `updatedAt`
orderSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

// Populate method for products
orderSchema.methods.populateProductDetails = function () {
  return this.populate('products.product', 'name');
};

// Model export
const Order = mongoose.models.Order || mongoose.model('Order', orderSchema);
module.exports = Order;
