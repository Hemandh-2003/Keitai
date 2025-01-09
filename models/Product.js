const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    category: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'Category', 
      required: true 
    },
    brand: { type: String, required: true, trim: true }, // Brand name
    regularPrice: { type: Number, required: true, min: 0 }, // Base price of the product
    salesPrice: { type: Number, min: 0 }, // Discounted price
    images: [{ type: String, required: true }], // Paths to uploaded images
    highlights: [{ type: String }], // Paths to uploaded highlight images
    description: { type: String, default: '', trim: true }, // Description of the product
    quantity: { type: Number, required: true, min: 0 }, // Stock quantity
    productOffer: { type: String, trim: true, default: '' }, // Optional offer details
    isBlocked: { type: Boolean, default: false }, // Block status for the product
    isDeleted: { type: Boolean, default: false }, // Soft delete status
  },
  { 
    timestamps: true, // Includes createdAt and updatedAt fields
    toJSON: { getters: true }, // Applies getters when returning JSON
    toObject: { getters: true } // Applies getters when returning plain objects
  }
);

// Pre-save validation to ensure sales price is not higher than the regular price
productSchema.pre('save', function (next) {
  if (this.salesPrice && this.salesPrice > this.regularPrice) {
    next(new Error('Sales price cannot be higher than the regular price.'));
  } else {
    next();
  }
});

module.exports = mongoose.model('Product', productSchema);
