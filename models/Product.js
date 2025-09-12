const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    name: { 
      type: String, 
      required: true, 
      trim: true 
    },
    category: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'Category', 
      required: true 
    },
    brand: { 
      type: String, 
      required: true, 
      trim: true 
    },
    regularPrice: { 
      type: Number, 
      required: true, 
      min: 0 
    },
    salesPrice: { 
      type: Number, 
      min: 0 
    },
    images: [{ 
      type: String, 
      required: true 
    }],
    highlights: [{ 
      type: String 
    }],
    description: { 
      type: String, 
      default: '', 
      trim: true 
    },
    quantity: { 
      type: Number, 
      required: true, 
      min: 0 
    },
    isBlocked: { 
      type: Boolean, 
      default: false 
    },
    isDeleted: { 
      type: Boolean, 
      default: false 
    },
    offers: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Offer'
    }],
    productOffer: { 
      type: String, 
      trim: true, 
      default: '' 
    },
    variants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product'
      }
    ]
  },
  { 
    timestamps: true,
    toJSON: { getters: true, virtuals: true },
    toObject: { getters: true, virtuals: true }
  }
);

productSchema.index({ name: 'text', description: 'text', brand: 'text' });

productSchema.pre('save', function (next) {
  if (this.salesPrice && this.salesPrice > this.regularPrice) {
    next(new Error('Sales price cannot be higher than the regular price.'));
  } else {
    next();
  }
});

productSchema.methods.isInStock = function () {
  return this.quantity > 0 && !this.isBlocked;
};

productSchema.methods.getDiscountPercentage = function () {
  if (this.salesPrice && this.regularPrice) {
    return Math.round(((this.regularPrice - this.salesPrice) / this.regularPrice) * 100);
  }
  return 0;
};

productSchema.methods.getFinalPrice = function () {
  return this.salesPrice || this.regularPrice;
};

// Virtuals
productSchema.virtual('availability').get(function () {
  if (this.isBlocked || this.isDeleted) {
    return 'Unavailable';
  }
  return this.quantity > 0 ? 'In Stock' : 'Out of Stock';
});

productSchema.methods.getBestOfferPrice = async function() {
  try {
    const Offer = mongoose.model('Offer');
    const now = new Date();

    const basePrice = this.salesPrice || this.regularPrice;

    const productOffers = await Offer.find({
      _id: { $in: this.offers || [] },
      isActive: true,
      startDate: { $lte: now },
      endDate: { $gte: now }
    });

    let categoryOffers = [];
    if (this.category) {
      const category = await mongoose.model('Category').findById(this.category).populate('offers');
      if (category && category.offers) {
        categoryOffers = category.offers.filter(offer =>
          offer.isActive && offer.startDate <= now && offer.endDate >= now
        );
      }
    }

    const allOffers = [...productOffers, ...categoryOffers];

    let bestDiscount = 0;
    let bestOffer = null;

    allOffers.forEach(offer => {
      if (!offer) return;
      const discount = offer.discountType === 'percentage'
        ? (basePrice * offer.discountValue) / 100
        : Math.min(offer.discountValue, basePrice);

      if (discount > bestDiscount) {
        bestDiscount = discount;
        bestOffer = offer;
      }
    });

    const finalPrice = Math.max(basePrice - bestDiscount, 0);

    return {
      price: finalPrice,
      originalPrice: basePrice,
      discount: bestDiscount,
      hasOffer: bestDiscount > 0,
      endDate: bestOffer ? bestOffer.endDate : null,
      offerName: bestOffer ? bestOffer.name : null
    };
  } catch (error) {
    console.error('Error calculating offer price:', error);
    const basePrice = this.salesPrice || this.regularPrice;
    return {
      price: basePrice,
      originalPrice: basePrice,
      discount: 0,
      hasOffer: false,
      endDate: null
    };
  }
};

module.exports = mongoose.model('Product', productSchema);
