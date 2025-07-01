const mongoose = require('mongoose');

const wishlistSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', // Reference to the User schema
    required: true,
  },
  products: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product', // Reference to the Product schema
      required: true,
    },
  ],
});

module.exports = mongoose.model('Wishlist', wishlistSchema);
