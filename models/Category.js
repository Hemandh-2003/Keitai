const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema(
  {
    name: { 
      type: String, 
      required: true, 
      trim: true,
      unique: true 
    },
    slug: { 
      type: String, 
      required: true, 
      unique: true 
    },
    description: { 
      type: String, 
      default: '' 
    },
    isDeleted: { 
      type: Boolean, 
      default: false 
    },
    // Add offers reference
    offers: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Offer'
    }],
    // Optional category-specific offer
    categoryOffer: { 
      type: String, 
      trim: true, 
      default: '' 
    }
  },
  { 
    timestamps: true 
  }
);

// Pre-save hook to generate slug
categorySchema.pre('save', function(next) {
  if (!this.slug) {
    this.slug = this.name.toLowerCase().replace(/\s+/g, '-');
  }
  next();
});

// Virtual for product count
categorySchema.virtual('productCount', {
  ref: 'Product',
  localField: '_id',
  foreignField: 'category',
  count: true
});

// Method to get active offers
categorySchema.methods.getActiveOffers = async function () {
  const Offer = mongoose.model('Offer');
  const now = new Date();

  const populatedCategory = await mongoose.model('Category')
    .findById(this._id)
    .populate({
      path: 'offers',
      match: {
        isActive: true,
        startDate: { $lte: now },
        endDate: { $gte: now }
      }
    });

  return populatedCategory?.offers || [];
};


module.exports = mongoose.model('Category', categorySchema);