const Category = require('../models/Category');
const Product = require('../models/Product');
const Offer = require('../models/Offer');
const {HTTP_STATUS}= require('../SM/status');
// OFFER MANAGEMENT
exports.listOffers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;

    const totalOffers = await Offer.countDocuments();
    const offers = await Offer.find()
      .populate('products')
      .populate('categories')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalPages = Math.ceil(totalOffers / limit);

    res.render('admin/offers', {
      offers,
      currentPage: page,
      totalPages,
      messages: res.locals.messages || {} 
    });
  } catch (error) {
    console.error('Error listing offers:', error);
    
    req.session.messages = {
      error: 'Failed to load offers'
    };
    res.redirect('/admin/dashboard');
  }
};
// Render add offer form
exports.addOfferForm = async (req, res) => {
  try {
    const products = await Product.find({ isBlocked: false });
    const categories = await Category.find({
  $or: [
    { isDeleted: false },
    { isDeleted: { $exists: false } } 
  ]
});
    res.render('admin/add-offer', { 
      products, 
      categories,
      offerTypes: ['product', 'category', 'referral'],
      discountTypes: ['percentage', 'fixed'],
      
      success_msg: req.flash('success_msg')[0], 
      error_msg: req.flash('error_msg')[0]      
    });
  } catch (error) {
    console.error('Error loading add offer form:', error);
    req.flash('error_msg', 'Error loading form');
    res.redirect('/admin/offers');
  }
};
function normalizeToArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  return [value]; 
}

// Create new offer
exports.createOffer = async (req, res) => {
  try {
    const {
      name, description, offerType, discountType, discountValue,
      startDate, endDate, products, categories,
      referralCode, referrerBonus, refereeBonus, minPurchaseAmount
    } = req.body;

    const selectedProducts = offerType === 'product' ? normalizeToArray(products) : [];
    const selectedCategories = offerType === 'category' ? normalizeToArray(categories) : [];

    
    if (offerType === 'product' && selectedProducts.length === 0) {
      req.flash('error_msg', 'Please select at least one product.');
      return res.redirect('/admin/offers/add');
    }

    if (offerType === 'category' && selectedCategories.length === 0) {
      req.flash('error_msg', 'Please select at least one category.');
      return res.redirect('/admin/offers/add');
    }

    const newOffer = new Offer({
      name: name.trim(),
      description,
      offerType,
      discountType,
      discountValue: parseInt(discountValue),
      startDate,
      endDate,
      isActive: true,
      products: selectedProducts,
      categories: selectedCategories,
      referralCode: offerType === 'referral' ? referralCode : undefined,
      referrerBonus: offerType === 'referral' ? referrerBonus : undefined,
      refereeBonus: offerType === 'referral' ? refereeBonus : undefined,
      minPurchaseAmount: offerType === 'referral' ? minPurchaseAmount : undefined
    });

    await newOffer.save();

    
    if (selectedProducts.length) {
      await Product.updateMany(
        { _id: { $in: selectedProducts } },
        { $addToSet: { offers: newOffer._id } }
      );
    }

    if (selectedCategories.length) {
      await Category.updateMany(
        { _id: { $in: selectedCategories } },
        { $addToSet: { offers: newOffer._id } }
      );
    }

    req.flash('success_msg', 'Offer created successfully');
    res.redirect('/admin/offers');

  } catch (err) {
    console.error('Offer creation error:', err);
    req.flash('error_msg', 'Error creating offer');
    res.redirect('/admin/offers/add');
  }
};



// Edit offer form
exports.editOfferForm = async (req, res) => {
  try {
    const offer = await Offer.findById(req.params.id);
    if (!offer) {
      req.flash('error', 'Offer not found.');
      return res.redirect('/admin/offers');
    }

    const products = await Product.find({ isBlocked: false });
    const categories = await Category.find({ isDeleted: false });

   // console.log('Offer fetched for editing:', offer); 

   res.render('admin/edit-offer', { 
  offer,
  products,
  categories,
  offerTypes: ['product', 'category', 'referral'],
  discountTypes: ['percentage', 'fixed'],
  selectedProducts: (offer.products || []).map(p => p.toString()),
  selectedCategories: (offer.categories || []).map(c => c.toString())
});

  } catch (error) {
    console.error('Error loading edit offer form:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send('Error loading form');
  }
};

// Update offer
exports.updateOffer = async (req, res) => {
  try {
    const {
      name, description, offerType, discountType, discountValue,
      startDate, endDate, products, categories,
      referralCode, referrerBonus, refereeBonus, minPurchaseAmount
    } = req.body;

    const offer = await Offer.findById(req.params.id);
    if (!offer) throw new Error('Offer not found');

   const selectedProducts = offerType === 'product' ? normalizeToArray(req.body.products) : [];
const selectedCategories = offerType === 'category' ? normalizeToArray(req.body.categories) : [];

    
    if (offer.offerType === 'product' && offer.products.length) {
      await Product.updateMany(
        { _id: { $in: offer.products } },
        { $pull: { offers: offer._id } }
      );
    }

    if (offer.offerType === 'category' && offer.categories.length) {
      await Category.updateMany(
        { _id: { $in: offer.categories } },
        { $pull: { offers: offer._id } }
      );
    }

    offer.name = name.trim();
    offer.description = description;
    offer.offerType = offerType;
    offer.discountType = discountType;
    offer.discountValue = discountValue;
    offer.startDate = startDate;
    offer.endDate = endDate;
    offer.isActive = req.body.hasOwnProperty('isActive');

    offer.products = selectedProducts;
    offer.categories = selectedCategories;

    if (offerType === 'referral') {
      offer.referralCode = referralCode;
      offer.referrerBonus = referrerBonus;
      offer.refereeBonus = refereeBonus;
      offer.minPurchaseAmount = minPurchaseAmount;
      offer.products = [];
      offer.categories = [];
    } else {
      offer.referralCode = undefined;
      offer.referrerBonus = undefined;
      offer.refereeBonus = undefined;
      offer.minPurchaseAmount = undefined;
    }

    await offer.save();

    if (selectedProducts.length) {
      await Product.updateMany(
        { _id: { $in: selectedProducts } },
        { $addToSet: { offers: offer._id } }
      );
    }

    if (selectedCategories.length) {
      await Category.updateMany(
        { _id: { $in: selectedCategories } },
        { $addToSet: { offers: offer._id } }
      );
    }

    req.flash('success', 'Offer updated successfully');
    res.redirect('/admin/offers');

  } catch (err) {
    console.error('❌ Offer update error:', err);
    req.flash('error', 'Error updating offer');
    res.redirect(`/admin/offers/edit/${req.params.id}`);
  }
};
// Toggle offer status
exports.toggleOfferStatus = async (req, res) => {
  try {
    const offer = await Offer.findById(req.params.id);
    if (!offer) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({ success: false, message: 'Offer not found' });
    }
    
    offer.isActive = !offer.isActive;
    await offer.save();
    
    res.json({ 
      success: true, 
      isActive: offer.isActive,
      message: `Offer ${offer.isActive ? 'activated' : 'deactivated'} successfully`
    });
  } catch (error) {
    console.error('Error toggling offer status:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ 
      success: false, 
      message: 'Server error',
      error: error.message 
    });
  }
};

// Delete offer
exports.deleteOffer = async (req, res) => {
  try {
    const offer = await Offer.findById(req.params.id);
    
    if (offer.offerType === 'product' && offer.products.length > 0) {
      await Product.updateMany(
        { _id: { $in: offer.products } },
        { $pull: { offers: offer._id } }
      );
    } else if (offer.offerType === 'category' && offer.categories.length > 0) {
      await Category.updateMany(
        { _id: { $in: offer.categories } },
        { $pull: { offers: offer._id } }
      );
    }
    
    await Offer.findByIdAndDelete(req.params.id);
    
    req.flash('success', 'Offer deleted successfully');
    res.redirect('/admin/offers');
  } catch (error) {
    console.error('Error deleting offer:', error);
    req.flash('error', 'Error deleting offer');
    res.redirect('/admin/offers');
  }
};