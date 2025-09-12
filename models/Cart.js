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


  this.totalPrice = this.items.reduce((total, item) => {
    const price = productMap[item.product.toString()] || 0; 
    return total + price * item.quantity;
  }, 0);
};
cartSchema.methods.calculateTotal = async function () {
  const productIds = this.items.map(item => item.product);

  const products = await mongoose.model('Product').find({ _id: { $in: productIds } });

  const productMap = {};
  for (const product of products) {
    const offer = product.getBestOfferPrice ? await product.getBestOfferPrice() : null;
    const price = offer?.price || product.salesPrice || product.regularPrice;
    productMap[product._id.toString()] = price;
  }

  this.totalPrice = this.items.reduce((total, item) => {
    const price = productMap[item.product.toString()] || 0;
    return total + price * item.quantity;
  }, 0);
};
module.exports = mongoose.model('Cart', cartSchema);
