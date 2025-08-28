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
     unitPrice: {   
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ['Active', 'Cancelled','Returned', 'Reurn Rejected'],
      default: 'Active',
    },
    cancellationReason: {
      type: String,
      default: '',
    },
    cancelledAt: {
      type: Date,
    }
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
  coupon: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Coupon',
    default: null,
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
    enum: ['COD', 'Card', 'Online', 'Wallet'], 
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
      'Return Requested',
      'Payment Failed',
      'Paid' // ✅ Paid added
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
        'Return Requested',
        'Return Approved',  
        'Return Rejected',   
        'Paid',
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

// Method to populate product details
orderSchema.methods.populateProductDetails = function () {
  return this.populate('products.product', 'name');
};

const Order = mongoose.models.Order || mongoose.model('Order', orderSchema);
module.exports = Order;
