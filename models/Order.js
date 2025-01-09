const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
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
      },
    },
  ],
  deliveryCharge: {
    type: Number,
    default: 80, // Default delivery charge
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
    enum: ['Pending', 'Shipped', 'Delivered', 'Cancelled', 'User Cancelled'],
    default: 'Pending',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Populate product name and quantity when fetching orders
orderSchema.methods.populateProductDetails = function () {
  return this.populate('products.product', 'name'); // Populate product name
};

// Check if the model already exists to avoid recompiling
const Order = mongoose.models.Order || mongoose.model('Order', orderSchema);

module.exports = Order;
