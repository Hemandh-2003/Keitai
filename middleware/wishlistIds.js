const Wishlist = require('../models/Wishlist');

const wishlistIdsMiddleware = async (req, res, next) => {
  try {
    if (req.isAuthenticated && req.isAuthenticated()) {
      const wishlist = await Wishlist.findOne({ user: req.user._id }).select('products');
      res.locals.wishlistIds = wishlist ? wishlist.products.map(p => p.toString()) : [];
    } else {
      res.locals.wishlistIds = [];
    }
    next();
  } catch (err) {
    console.error('Error in wishlistIdsMiddleware:', err);
    res.locals.wishlistIds = [];
    next();
  }
};

module.exports = wishlistIdsMiddleware;

