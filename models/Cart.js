const mongoose = require('mongoose');

const cartSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  items: [
    {
      product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
      quantity: { type: Number, required: true, min: 1 },
    },
  ],
  totalPrice: { type: Number, default: 0 },
}, { timestamps: true });

cartSchema.methods.calculateTotal = async function () {
  const productIds = this.items.map(item => item.product);

  const products = await mongoose.model('Product').find({ _id: { $in: productIds } });

  const productMap = products.reduce((map, product) => {
    map[product._id.toString()] = product.salesPrice || product.regularPrice;
    return map;
  }, {});

  // Calculate the total price
  this.totalPrice = this.items.reduce((total, item) => {
    const price = productMap[item.product.toString()] || 0; // Default to 0 if product not found
    return total + price * item.quantity;
  }, 0);
};

module.exports = mongoose.model('Cart', cartSchema);
